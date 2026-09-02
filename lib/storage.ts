/**
 * Where uploaded room photos go.
 *
 * Two drivers, chosen by whether BLOB_READ_WRITE_TOKEN is set:
 *
 *   Vercel Blob  — used whenever the token exists. The only option that works
 *                  deployed, because Vercel's filesystem is read-only.
 *   Local disk   — a development convenience that writes into public/rooms/ so
 *                  the panel is usable before anyone pastes a token.
 *
 * The local driver deliberately refuses to run in production rather than
 * appearing to work and silently dropping files: a write to public/ on Vercel
 * either throws or lands on an instance that is about to disappear.
 *
 * Everything is funnelled through `putRoomImage` / `deleteRoomImage`, so
 * swapping in S3 or R2 later means writing one more driver here and nothing
 * else.
 */
import { mkdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

import { del, put } from "@vercel/blob";

import { MAX_IMAGE_BYTES } from "./validation";

const LOCAL_DIR = path.join("public", "rooms");
const LOCAL_PREFIX = "/rooms/";

export type StoredImage = { url: string; driver: "blob" | "local" };

export function storageDriver(): "blob" | "local" {
  return process.env.BLOB_READ_WRITE_TOKEN ? "blob" : "local";
}

/** Human-readable note for the admin panel, so the driver in use is never a surprise. */
export function storageStatus(): { driver: "blob" | "local"; note: string } {
  if (storageDriver() === "blob") {
    return { driver: "blob", note: "Uploads go to Vercel Blob." };
  }
  return {
    driver: "local",
    note: "No BLOB_READ_WRITE_TOKEN set — uploads are written to public/rooms/ for local development only, and will not work once deployed.",
  };
}

const EXTENSIONS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/avif": "avif",
};

export function isAllowedImageType(type: string): boolean {
  return type in EXTENSIONS;
}

/** A stable, collision-proof object name: room slug + timestamp + random. */
function objectName(roomSlug: string, contentType: string): string {
  const ext = EXTENSIONS[contentType] ?? "jpg";
  const stamp = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 8);
  return `${roomSlug}-${stamp}${rand}.${ext}`;
}

export async function putRoomImage(
  roomSlug: string,
  file: File,
): Promise<StoredImage> {
  if (!isAllowedImageType(file.type)) {
    throw new Error(`Unsupported image type: ${file.type || "unknown"}`);
  }
  if (file.size > MAX_IMAGE_BYTES) {
    throw new Error(`Image is larger than ${Math.round(MAX_IMAGE_BYTES / 1024 / 1024)} MB`);
  }

  const name = objectName(roomSlug, file.type);

  if (storageDriver() === "blob") {
    const blob = await put(`rooms/${name}`, file, {
      access: "public",
      contentType: file.type,
      // The name is already unique; without this Blob appends its own suffix.
      addRandomSuffix: false,
    });
    return { url: blob.url, driver: "blob" };
  }

  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "Uploads need a Vercel Blob store in production. Set BLOB_READ_WRITE_TOKEN.",
    );
  }

  await mkdir(LOCAL_DIR, { recursive: true });
  await writeFile(
    path.join(LOCAL_DIR, name),
    Buffer.from(await file.arrayBuffer()),
  );
  return { url: `${LOCAL_PREFIX}${name}`, driver: "local" };
}

/**
 * Best-effort removal of the stored file. Detaching an image from a room must
 * succeed even if the object is already gone, so failures here are swallowed —
 * an orphaned file is a much smaller problem than a row that cannot be deleted.
 */
export async function deleteRoomImage(url: string): Promise<void> {
  try {
    if (url.startsWith("http")) {
      await del(url);
      return;
    }
    // Only ever unlink inside public/rooms, never an arbitrary path.
    if (!url.startsWith(LOCAL_PREFIX)) return;
    const name = path.basename(url);
    await unlink(path.join(LOCAL_DIR, name));
  } catch {
    // Already deleted, or never existed. Nothing useful to do.
  }
}

/**
 * Seeded artwork lives in the repo and must survive a re-seed, so the panel
 * detaches those rather than deleting the file.
 */
export function isManagedUpload(url: string): boolean {
  if (url.startsWith("http")) return true;
  return url.startsWith(LOCAL_PREFIX) && !url.startsWith("/plans/");
}
