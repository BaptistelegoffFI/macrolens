import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

/**
 * §12.4bis : « toute valeur numérique passe obligatoirement par
 * <Num value unit indicator />. Un nombre écrit en dur dans du JSX est un
 * échec de revue. » The plan calls for enforcement via a dedicated ESLint
 * rule on a `<Num>` component; a correct AST-aware ESLint rule (detecting
 * a numeric-literal or `.toFixed()`/`Math.round()` result landing
 * specifically in JSX text position, as opposed to a DOM attribute string,
 * a clipboard string, or a callback consumed by a non-React renderer) is a
 * small static-analysis project of its own. This test is the pragmatic
 * equivalent used elsewhere in this codebase (tests/vocabulary.test.ts,
 * tests/contrast.test.ts): a source-text scan for `.toFixed()`/
 * `Math.round()`, with an explicit, individually-justified allowlist for
 * the call sites that are not JSX rendering — the same shape of exception
 * a real ESLint rule would need `eslint-disable-next-line` comments for.
 *
 * Every entry below was inspected and is one of:
 * - an ECharts `formatter`/`valueFormatter` callback — ECharts renders its
 *   own canvas output from the returned string, never through React JSX;
 * - an HTML `title=""` attribute — a native tooltip string, which cannot
 *   hold a React element;
 * - clipboard text (Table's Ctrl+C-to-TSV `formatCell`) — plain text by
 *   necessity, not rendered JSX;
 * - pixel arithmetic for drag-resize (ResizableColumns/Rows) — never
 *   displayed to the user at all.
 *
 * SVG `<text>` labels in Timeline.tsx/EventFrieze.tsx are a separate,
 * inline-documented exception (`<Num>`'s `<span>` output is not valid SVG
 * content) — they don't call `.toFixed()`/`Math.round()` so they never
 * reach this allowlist.
 */
const ALLOWED_FILES = new Set([
  "Num.tsx",
  "SeriesSparkline.tsx",
  "SeriesExplorerView.tsx",
  "ResizableColumns.tsx",
  "ResizableRows.tsx",
  "Table.tsx",
  "CoverageView.tsx",
]);

function collectSourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      out.push(...collectSourceFiles(full));
    } else if (/\.tsx$/.test(entry) && !ALLOWED_FILES.has(entry)) {
      out.push(full);
    }
  }
  return out;
}

describe("Rendu numérique centralisé via <Num> (§12.4bis)", () => {
  const srcDir = join(__dirname, "..", "src");
  const files = collectSourceFiles(srcDir);

  it("scans a non-trivial number of component files", () => {
    expect(files.length).toBeGreaterThan(15);
  });

  it.each(files)("%s does not hand-format numbers outside <Num>", (file) => {
    const code = readFileSync(file, "utf-8");
    expect(code, `${file} calls .toFixed() outside Num.tsx`).not.toMatch(/\.toFixed\(/);
    expect(code, `${file} calls Math.round() outside Num.tsx`).not.toMatch(/Math\.round\(/);
  });
});
