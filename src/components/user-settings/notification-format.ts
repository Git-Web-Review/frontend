import type { TranslationKey } from "../../i18n/translations";

type FormatView = typeof SAMPLE_VIEW;

/**
 * Must agree with the relays' table (irc-relay and email-relay,
 * src/printf-format.js), which render the real notification.
 */
export const FORMAT_SPECIFIERS: {
  key: string;
  label: TranslationKey;
  value: (view: FormatView) => string | number | null;
}[] = [
  { key: "A", label: "formatSpecApp", value: (view) => view.app },
  { key: "t", label: "formatSpecTitle", value: (view) => view.title },
  { key: "u", label: "formatSpecUrl", value: (view) => view.url },
  { key: "g", label: "formatSpecGitwebUrl", value: (view) => view.gitwebUrl },
  { key: "a", label: "formatSpecActor", value: (view) => view.actor },
  { key: "o", label: "formatSpecOwner", value: (view) => view.ownerEmail },
  { key: "m", label: "formatSpecMessage", value: (view) => view.message },
  {
    key: "c",
    label: "formatSpecComment",
    value: (view) => view.commentExcerpt,
  },
  { key: "f", label: "formatSpecFile", value: (view) => view.payload.filePath },
  {
    key: "l",
    label: "formatSpecLine",
    value: (view) => view.payload.lineNumber,
  },
  {
    key: "s",
    label: "formatSpecPreviousStatus",
    value: (view) => view.previousStatusLabel,
  },
  {
    key: "S",
    label: "formatSpecNextStatus",
    value: (view) => view.nextStatusLabel,
  },
  { key: "p", label: "formatSpecProject", value: (view) => view.sourceProject },
  { key: "b", label: "formatSpecBranch", value: (view) => view.sourceBranch },
  { key: "h", label: "formatSpecCommit", value: (view) => view.sourceCommit },
  {
    key: "v",
    label: "formatSpecVersion",
    value: (view) => view.payload.version,
  },
  {
    key: "k",
    label: "formatSpecCommitCount",
    value: (view) => view.payload.commitCount,
  },
  {
    key: "K",
    label: "formatSpecCommitTitles",
    value: (view) => view.payload.commitTitles.join(", "),
  },
];

/** What the preview renders: one made-up notification with every field set. */
const SAMPLE_VIEW = {
  app: "git-web-review",
  title: "Fix login redirect",
  url: `${window.location.origin}/review/42?comment=7`,
  gitwebUrl: "https://git.company.tld/?p=auth.git;a=commit;h=3f2a9c1",
  actor: "alice",
  ownerEmail: "bob@company.tld",
  message: "Please have a look before Friday",
  commentExcerpt: "Should this redirect keep the query string?",
  previousStatusLabel: "In review",
  nextStatusLabel: "Approved",
  sourceProject: "auth",
  sourceBranch: "fix/login-redirect",
  sourceCommit: "3f2a9c1",
  payload: {
    filePath: "src/login.ts",
    lineNumber: 128,
    version: 3,
    commitCount: 2,
    commitTitles: ["fix: keep the redirect target", "test: cover the redirect"],
  },
};

export const formatSample = (format: string) =>
  format.replace(/%([%A-Za-z])/g, (match, key: string) => {
    if (key === "%") {
      return "%";
    }
    const specifier = FORMAT_SPECIFIERS.find((entry) => entry.key === key);
    return specifier ? String(specifier.value(SAMPLE_VIEW) ?? "") : match;
  });
