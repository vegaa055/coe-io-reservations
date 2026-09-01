/**
 * Produce the two served copies of the COE Intelligence Operations logo:
 *
 *     npm run logo
 *
 * The supplied artwork draws the wordmark in Arizona Blue (#00275B), which is
 * unreadable on the app's dark background — the block A survives only because
 * it sits on its own white field. So a reversed copy is generated for dark
 * mode, and the header picks between them with prefers-color-scheme.
 *
 * The rule: recolour the navy <path> and <rect> elements (the divider rule, the
 * registered mark, and the wordmark itself, all of which sit on the page
 * background) and leave the navy <polygon> alone (the block A's frame, which
 * sits on the logo's own white field and must stay dark to be visible).
 *
 * That rule fits this artwork. If the logo is ever replaced, re-run this and
 * check the result — it prints what it changed.
 */
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const SRC = path.join("img", "COE_Intelligence-Operations_ALTERNATE.svg");
const OUT_LIGHT = path.join("public", "coe-intelligence-operations.svg");
const OUT_DARK = path.join("public", "coe-intelligence-operations-dark.svg");

const NAVY = "#00275B";
/** Reversed logos use plain white rather than the UI's off-white text colour. */
const REVERSED = "#FFFFFF";

async function main() {
  const svg = await readFile(SRC, "utf8");

  let recoloured = 0;
  let kept = 0;

  const dark = svg.replace(/<(polygon|path|rect)\b[^>]*?\/?>/gs, (element, tag) => {
    if (!element.includes(`fill:${NAVY}`)) return element;
    if (tag === "polygon") {
      kept += 1;
      return element;
    }
    recoloured += 1;
    return element.replace(`fill:${NAVY}`, `fill:${REVERSED}`);
  });

  await writeFile(OUT_LIGHT, svg, "utf8");
  await writeFile(OUT_DARK, dark, "utf8");

  console.log(`${OUT_LIGHT}  (unchanged original)`);
  console.log(`${OUT_DARK}  ${recoloured} element(s) reversed to ${REVERSED}, ${kept} left navy`);

  if (recoloured === 0) {
    console.log("\nNothing was recoloured — check that the artwork still uses " + NAVY + ".");
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
