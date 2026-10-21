import { codeFromDiffLine, type DiffRenderRow } from "./review-utils";

export type ChangedRange = readonly [start: number, end: number];

const isChange = (row: DiffRenderRow, marker: "-" | "+") =>
  row.kind === "line" &&
  row.lineNumber !== null &&
  row.text.startsWith(marker);

// Same rule as git's contrib/diff-highlight: pair the i-th removed line with
// the i-th added line of a block only when both sides have the same length,
// then mark everything between the common prefix and the common suffix.
const pairRanges = (
  removed: string,
  added: string,
): [ChangedRange, ChangedRange] | null => {
  const max = Math.min(removed.length, added.length);
  let prefix = 0;
  while (prefix < max && removed[prefix] === added[prefix]) {
    prefix += 1;
  }
  let suffix = 0;
  while (
    suffix < max - prefix &&
    removed[removed.length - 1 - suffix] === added[added.length - 1 - suffix]
  ) {
    suffix += 1;
  }
  // Nothing meaningful in common: the whole line would light up, skip it.
  if (suffix === 0 && !removed.slice(0, prefix).trim()) {
    return null;
  }
  return [
    [prefix, removed.length - suffix],
    [prefix, added.length - suffix],
  ];
};

export const changedRanges = (rows: DiffRenderRow[]) => {
  const ranges = new Map<string, ChangedRange>();
  let index = 0;
  while (index < rows.length) {
    const removedStart = index;
    while (index < rows.length && isChange(rows[index], "-")) index += 1;
    const addedStart = index;
    while (index < rows.length && isChange(rows[index], "+")) index += 1;
    const count = addedStart - removedStart;

    if (count > 0 && index - addedStart === count) {
      for (let offset = 0; offset < count; offset += 1) {
        const removedRow = rows[removedStart + offset];
        const addedRow = rows[addedStart + offset];
        const pair = pairRanges(
          codeFromDiffLine(removedRow.text),
          codeFromDiffLine(addedRow.text),
        );
        if (pair) {
          ranges.set(removedRow.key, pair[0]);
          ranges.set(addedRow.key, pair[1]);
        }
      }
    }
    if (index === removedStart) index += 1;
  }
  return ranges;
};

const markOpen = '<span class="diff-word-changed">';

// Wraps the text characters [start, end) of highlighted HTML, closing and
// reopening the mark around every tag so the nesting stays valid.
export const markRange = (html: string, [start, end]: ChangedRange) => {
  if (start >= end) {
    return html;
  }
  let out = "";
  let position = 0;
  let open = false;
  let index = 0;
  while (index < html.length) {
    if (html[index] === "<") {
      const tagEnd = html.indexOf(">", index) + 1;
      if (open) {
        out += "</span>";
        open = false;
      }
      out += html.slice(index, tagEnd);
      index = tagEnd;
      continue;
    }
    const wanted = position >= start && position < end;
    if (wanted !== open) {
      out += wanted ? markOpen : "</span>";
      open = wanted;
    }
    const length = html[index] === "&" ? html.indexOf(";", index) + 1 - index : 1;
    out += html.slice(index, index + length);
    index += length;
    position += 1;
  }
  return open ? `${out}</span>` : out;
};
