/**
 * Git branch glyph.
 *
 * Bootstrap Icons ships no `git-branch`, and the `diagram-3` org-chart that
 * stood in for it reads as a hierarchy, not a branch. This is the Octicon
 * `git-branch-16` path: two commits on a line, a third branching off it.
 *
 * Sized in `em` and painted with `currentColor`, so it inherits the font size
 * and colour of the label it sits next to, like the `bi` glyphs around it.
 */
export function GitBranchIcon({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="currentColor"
      focusable="false"
      height="1em"
      viewBox="0 0 16 16"
      width="1em"
    >
      <path d="M9.5 3.25a2.25 2.25 0 1 1 3 2.122V6A2.5 2.5 0 0 1 10 8.5H6a1 1 0 0 0-1 1v1.128a2.251 2.251 0 1 1-1.5 0V5.372a2.25 2.25 0 1 1 1.5 0v1.836A2.493 2.493 0 0 1 6 7h4a1 1 0 0 0 1-1v-.628A2.25 2.25 0 0 1 9.5 3.25Zm-6 0a.75.75 0 1 0 1.5 0 .75.75 0 0 0-1.5 0Zm8.25-.75a.75.75 0 1 0 0 1.5.75.75 0 0 0 0-1.5ZM4.25 12a.75.75 0 1 0 0 1.5.75.75 0 0 0 0-1.5Z" />
    </svg>
  );
}
