import type { ReactNode } from "react";
import type { CommitLogLinkRule } from "../../types/api";
import { shortHostname } from "./review-utils";

export type GitwebLinkSource = {
  gitwebUrl: string;
  sourceCommit: string | null;
};

export const gitwebParams = (gitwebUrl: string) => {
  const params = new Map<string, string>();
  const query = gitwebUrl.split("?")[1] ?? "";

  for (const segment of query.split(/[&;]/)) {
    const [key, ...valueParts] = segment.split("=");
    if (!key) {
      continue;
    }
    params.set(
      decodeURIComponent(key),
      decodeURIComponent(valueParts.join("=")),
    );
  }

  return params;
};

export const gitwebBlobUrl = (
  gitwebUrl: string,
  filePath: string,
  blobHash: string | null,
  baseCommitHash?: string,
) => {
  if (!blobHash) {
    return null;
  }

  const project = gitwebParams(gitwebUrl).get("p");
  if (!project) {
    return null;
  }

  try {
    const url = new URL(gitwebUrl);
    const params = [
      `p=${encodeURIComponent(project)}`,
      "a=blob",
      `f=${encodeURIComponent(filePath).replace(/%2F/g, "/")}`,
      `h=${blobHash}`,
      ...(baseCommitHash ? [`hb=${baseCommitHash}`] : []),
    ];
    return `${url.origin}${url.pathname}?${params.join(";")}`;
  } catch {
    return null;
  }
};

export const diffMetaLink = (
  url: string | null,
  text: string,
  className?: string,
): ReactNode =>
  url ? (
    <a
      className={`diff-meta-link${className ? ` ${className}` : ""}`}
      href={url}
      rel="noreferrer"
      target="_blank"
    >
      {text}
    </a>
  ) : (
    <span className={className}>{text}</span>
  );

export const gitwebTemplateVariables = (source: GitwebLinkSource) => {
  const params = gitwebParams(source.gitwebUrl);
  const project = params.get("p") ?? "";
  const [username = "", rawComponent = ""] = project.split("/");
  const component = rawComponent.replace(/\.git$/, "");

  try {
    const url = new URL(source.gitwebUrl);
    return {
      USERNAME: username,
      HOSTNAME: shortHostname(url.hostname),
      PROJECT: component,
      COMPONENT: component,
      HASH: params.get("h") ?? source.sourceCommit ?? "",
    };
  } catch {
    return {
      USERNAME: username,
      HOSTNAME: "",
      PROJECT: component,
      COMPONENT: component,
      HASH: params.get("h") ?? source.sourceCommit ?? "",
    };
  }
};

export const hrefFromRule = (
  rule: CommitLogLinkRule,
  match: RegExpExecArray,
  templateVariables: Record<string, string>,
) =>
  rule.linkTemplate.replace(/\$\{([^}]+)\}/g, (_token, groupName) => {
    const indexedGroup = Number(groupName);
    if (Number.isInteger(indexedGroup)) {
      return match[indexedGroup] ?? "";
    }

    return match.groups?.[groupName] ?? templateVariables[groupName] ?? "";
  });

export const linkedCommitLog = (
  text: string,
  source: GitwebLinkSource,
  commitLogLinkRules: CommitLogLinkRule[],
): ReactNode[] => {
  const nodes: ReactNode[] = [];
  let cursor = 0;
  const templateVariables = gitwebTemplateVariables(source);

  while (cursor < text.length) {
    let bestMatch: { rule: CommitLogLinkRule; match: RegExpExecArray } | null =
      null;

    for (const rule of commitLogLinkRules) {
      if (!rule.enabled) {
        continue;
      }

      try {
        const regex = new RegExp(rule.regex, "g");
        regex.lastIndex = cursor;
        const match = regex.exec(text);
        if (!match || match.index < cursor || match[0].length === 0) {
          continue;
        }
        if (!bestMatch || match.index < bestMatch.match.index) {
          bestMatch = { rule, match };
        }
      } catch {
        continue;
      }
    }

    if (!bestMatch) {
      nodes.push(text.slice(cursor));
      break;
    }

    const { rule, match } = bestMatch;
    if (match.index > cursor) {
      nodes.push(text.slice(cursor, match.index));
    }
    nodes.push(
      <a
        className="commit-log-link"
        href={hrefFromRule(rule, match, templateVariables)}
        key={`${match.index}-${match[0]}`}
        rel="noreferrer"
        target="_blank"
      >
        {match[0]}
      </a>,
    );
    cursor = match.index + match[0].length;
  }

  return nodes;
};
