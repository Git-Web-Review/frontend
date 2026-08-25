import type { CommitLogLinkRule } from "../../types/api";
import {
  gitwebTemplateVariables,
  hrefFromRule,
  type GitwebLinkSource,
} from "../review/gitweb-links";

export type CommitLogMatchSource = GitwebLinkSource & {
  gitwebLog: string | null;
};

export type CommitLogMatch = {
  key: string;
  label: string;
  text: string;
  href: string;
  index: number;
};

export type DashboardSection = "owned" | "assigned" | "done";

export const DASHBOARD_PAGE_SIZE = 10;

export const emptyDashboardPage = () => ({
  items: [],
  page: 1,
  limit: DASHBOARD_PAGE_SIZE,
  total: 0,
  totalPages: 0,
});

export const dashboardLinkFromSearch = (search: string) => {
  const query = search.startsWith("?") ? search.slice(1) : search;
  const linkPrefixIndex = query.search(/(?:^|&)link=/);
  if (linkPrefixIndex === -1) {
    return "";
  }

  const rawLink = query.slice(
    linkPrefixIndex + (query[linkPrefixIndex] === "&" ? "&link=".length : "link=".length),
  );
  const decodedLink = (() => {
    try {
      return decodeURIComponent(rawLink);
    } catch {
      return rawLink;
    }
  })();

  return decodedLink.trim().replace(/\\([?=;&])/g, "$1");
};

export const commitLogMatches = (
  source: CommitLogMatchSource,
  commitLogLinkRules: CommitLogLinkRule[],
  matchLabel: string,
): CommitLogMatch[] => {
  const text = source.gitwebLog ?? "";
  const templateVariables = gitwebTemplateVariables(source);
  const matches: CommitLogMatch[] = [];
  const seenMatches = new Set<string>();

  for (const rule of commitLogLinkRules) {
    if (!rule.enabled) {
      continue;
    }

    try {
      const regex = new RegExp(rule.regex, "g");
      let match: RegExpExecArray | null;
      while ((match = regex.exec(text))) {
        if (match[0].length === 0) {
          regex.lastIndex += 1;
          continue;
        }

        const href = hrefFromRule(rule, match, templateVariables);
        const key = `${rule.id}:${match.index}:${match[0]}:${href}`;
        if (seenMatches.has(key)) {
          continue;
        }

        seenMatches.add(key);
        matches.push({
          key,
          label: rule.label || matchLabel,
          text: match[0],
          href,
          index: match.index,
        });
      }
    } catch {
      continue;
    }
  }

  return matches.sort((left, right) => left.index - right.index);
};
