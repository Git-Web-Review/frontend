import type { TranslationKey } from "../i18n/translations";

const NO_COMMITS_AHEAD_PATTERN =
  /^No commits to review on branch "(?<branch>[^"]+)"/;

export const gitwebFetchErrorLabel = (
  fetchError: string,
  t: (key: TranslationKey) => string,
): string => {
  const match = NO_COMMITS_AHEAD_PATTERN.exec(fetchError);
  if (match?.groups?.branch) {
    return t("noCommitsAheadOfMaster").replace("{branch}", match.groups.branch);
  }

  return fetchError;
};
