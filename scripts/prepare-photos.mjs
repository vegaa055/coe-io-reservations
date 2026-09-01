/**
 * Turns the full-resolution originals in img/ into web-sized copies under
 * public/rooms/.  Run it after dropping new photos in:
 *
 *     npm run photos
 *
 * Why this exists rather than copying files by hand:
 *
 *  - **Orientation.** Phone cameras record rotation in an EXIF tag instead of
 *    rotating the pixels. Browsers honour that tag, most image tools do not, so
 *    a photo can look fine in one place and upside down in another. `.rotate()`
 *    with no argument bakes the EXIF rotation into the pixels and drops the
 *    tag, so the file is unambiguous everywhere. Two of the JAG-Ed Center
 *    photos are orientation 3 (180°) and need exactly this.
 *
 *  - **Size.** The originals are 3–5 MB each. The gallery never displays wider
 *    than about 640 CSS px, so 2560 px is still 2x headroom on a retina screen
 *    at a fraction of the bytes. The originals stay in img/ as the archive.
 *
 * Adding a photo for a room that does not have one yet? Run this, then add the
 * file to that room's `images` array in prisma/seed.ts and re-seed — the app
 * reads image URLs from the database, not from the filesystem.
 */
import { copyFile, mkdir, readFile, readdir, rm, stat } from "node:fs/promises";
import path from "node:path";

import sharp from "sharp";

const SRC_DIR = "img";
const OUT_DIR = path.join("public", "rooms");
const MAX_WIDTH = 2560;
const QUALITY = 82;

/** Originals whose filename does not already match the room slug. */
const RENAME = {
  "jag-ed1.jpg": "jag-ed-center-1.jpg",
  "jag-ed2.jpg": "jag-ed-center-2.jpg",
  "jag-ed3.jpg": "jag-ed-center-3.jpg",
};

/**
 * Served filenames are always lowercased.
 *
 * This matters more than it looks. Windows filesystems are case-insensitive, so
 * "B154.jpg" on disk happily answers a request for "/rooms/b154.jpg" locally —
 * and then 404s on Vercel, which is Linux and case-sensitive. Normalising here
 * means a photo dropped in as "B154.jpg" behaves the same in both places.
 */
function servedName(original) {
  return (RENAME[original] ?? original).toLowerCase();
}

function kb(bytes) {
  return `${(bytes / 1024).toFixed(0)} KB`;
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true });

  const entries = await readdir(SRC_DIR);
  const photos = entries.filter((name) => /\.jpe?g$/i.test(name));

  if (photos.length === 0) {
    console.log(`No .jpg files found in ${SRC_DIR}/`);
    return;
  }

  let totalIn = 0;
  let totalOut = 0;

  for (const name of photos.sort()) {
    const src = path.join(SRC_DIR, name);
    const dest = path.join(OUT_DIR, servedName(name));
    const before = (await stat(src)).size;
    totalIn += before;

    // `failOn: "none"` decodes what is there instead of rejecting the whole
    // file. One of the Galaxy S24 wide shots has a malformed scan header that
    // libvips refuses by default but that every viewer reads happily.
    const image = sharp(src, { failOn: "none" });
    const { width, height, orientation } = await image.metadata();
    const needsRotate = Boolean(orientation && orientation !== 1);

    // Re-encoding an already web-sized JPEG only loses quality, so copy those
    // through untouched unless they carry an orientation tag to bake in.
    if (width <= MAX_WIDTH && !needsRotate) {
      await copyFile(src, dest);
      totalOut += before;
      console.log(`${name}  ${width}x${height} ${kb(before)}  ->  copied unchanged`);
      continue;
    }

    const info = await image
      // No argument = use the EXIF orientation, then discard the tag.
      .rotate()
      .resize({ width: MAX_WIDTH, withoutEnlargement: true })
      .jpeg({ quality: QUALITY, progressive: true, mozjpeg: true })
      .toFile(dest);

    totalOut += info.size;

    const rotated = needsRotate ? `  (EXIF ${orientation} baked in)` : "";
    console.log(
      `${name}  ${width}x${height} ${kb(before)}  ->  ${path.basename(dest)}  ` +
        `${info.width}x${info.height} ${kb(info.size)}${rotated}`,
    );
  }

  console.log(`\n${photos.length} photos: ${kb(totalIn)} -> ${kb(totalOut)}`);
  await warnAboutUnreferenced(photos);
  await purgeImageCache();
}

/**
 * The app reads image URLs from the database, so a processed photo that no
 * room's `images` array mentions is invisible however many times you re-run
 * this. That is the easy trap when adding a photo to a room that did not have
 * one, so say so plainly rather than failing silently.
 */
async function warnAboutUnreferenced(photos) {
  let seed;
  try {
    seed = await readFile(path.join("prisma", "seed.ts"), "utf8");
  } catch {
    return;
  }

  const orphans = photos.map(servedName).filter((name) => !seed.includes("/rooms/" + name));
  if (orphans.length === 0) return;

  console.log("");
  console.log(orphans.length + " photo(s) not referenced by prisma/seed.ts:");
  for (const name of orphans) console.log("  /rooms/" + name);
  console.log("Add each to that room's `images` array, then run: npm run db:seed");
}

/**
 * next/image caches optimised output on disk under a key of
 * (url, width, quality, format) — and the url does not change when a file is
 * replaced in place. Without this, a new photo at an existing path keeps
 * serving the old bytes, and confusingly only for the formats a browser had
 * already requested: curl gets a fresh JPEG while Chrome gets a stale WebP.
 *
 * Next 16 keeps the dev cache separate from the build cache, so clear both.
 */
async function purgeImageCache() {
  const caches = [
    path.join(".next", "dev", "cache", "images"),
    path.join(".next", "cache", "images"),
  ];

  for (const dir of caches) {
    try {
      const entries = await readdir(dir);
      await rm(dir, { recursive: true, force: true });
      console.log(`Cleared ${entries.length} cached variants from ${dir}`);
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
