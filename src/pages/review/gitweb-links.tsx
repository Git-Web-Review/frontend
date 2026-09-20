import type { ReactNode } from "react";
import type { CommitLogLinkRule } from "../../types/api";
import { shortHostname } from "./review-utils";

export type GitwebLinkSource = {
  gitwebUrl: string;
  // The gitweb project page resolved by the backend when the review URL is
  // not a gitweb page itself (e.g. a git:// remote).
  gitwebProjectUrl?: string | null;
  sourceCommit: string | null;
};

/** Where "open in git web" goes: a git:// URL does not open in a browser. */
export const gitwebBrowseUrl = (source: GitwebLinkSource) =>
  /^https?:\/\//i.test(source.gitwebUrl)
    ? source.gitwebUrl
    : (source.gitwebProjectUrl ?? source.gitwebUrl);

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

/** A gitweb action on the same project as the review URL. */
const gitwebActionUrl = (gitwebUrl: string, params: string[]) => {
  const project = gitwebParams(gitwebUrl).get("p");
  if (!project) {
    return null;
  }

  try {
    const url = new URL(gitwebUrl);
    return `${url.origin}${url.pathname}?${[
      `p=${encodeURIComponent(project)}`,
      ...params,
    ].join(";")}`;
  } catch {
    return null;
  }
};

/** gitweb keeps the slashes of `f=` readable. */
const gitwebFileParam = (filePath: string) =>
  encodeURIComponent(filePath).replace(/%2F/g, "/");

export const gitwebBlobUrl = (
  gitwebUrl: string,
  filePath: string,
  blobHash: string | null,
  baseCommitHash?: string,
) =>
  blobHash
    ? gitwebActionUrl(gitwebUrl, [
        "a=blob",
        `f=${gitwebFileParam(filePath)}`,
        `h=${blobHash}`,
        ...(baseCommitHash ? [`hb=${baseCommitHash}`] : []),
      ])
    : null;

export type GitwebFileAction = "blobdiff" | "blob" | "blame" | "history";

export type GitwebFileTarget = {
  path: string;
  oldPath: string | null;
  status: string;
  oldHash: string | null;
  newHash: string | null;
};

/**
 * The links gitweb puts next to every file of a commit. A file the commit
 * deletes is no longer in its tree, so gitweb would 404 on a path lookup:
 * its links carry the parent blob hash instead, and it has no blame at all.
 */
export const gitwebFileActions = (
  gitwebUrl: string,
  commitHash: string,
  file: GitwebFileTarget,
): Record<GitwebFileAction, string | null> => {
  const deleted = file.status === "DELETED";
  const path = gitwebFileParam(file.path);
  const oldPath = gitwebFileParam(file.oldPath ?? file.path);
  const blobHash = deleted ? file.oldHash : file.newHash;

  return {
    // Without a parent commit hash the diff is asked for blob against blob,
    // which gitweb answers as long as both sides exist.
    blobdiff:
      file.oldHash && file.newHash
        ? gitwebActionUrl(gitwebUrl, [
            "a=blobdiff",
            `f=${path}`,
            ...(file.oldPath ? [`fp=${oldPath}`] : []),
            `h=${file.newHash}`,
            `hp=${file.oldHash}`,
            `hb=${commitHash}`,
          ])
        : null,
    blob: blobHash
      ? gitwebActionUrl(gitwebUrl, [
          "a=blob",
          `f=${deleted ? oldPath : path}`,
          `h=${blobHash}`,
          ...(deleted ? [] : [`hb=${commitHash}`]),
        ])
      : null,
    blame: deleted
      ? null
      : gitwebActionUrl(gitwebUrl, [
          "a=blame",
          `f=${path}`,
          `hb=${commitHash}`,
          ...(file.newHash ? [`h=${file.newHash}`] : []),
        ]),
    history: blobHash
      ? gitwebActionUrl(gitwebUrl, [
          "a=history",
          `f=${deleted ? oldPath : path}`,
          `h=${blobHash}`,
          `hb=${commitHash}`,
        ])
      : null,
  };
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
  const projectPageUrl = source.gitwebProjectUrl ?? source.gitwebUrl;
  const params = gitwebParams(source.gitwebUrl);
  const project = gitwebParams(projectPageUrl).get("p") ?? "";
  const [username = "", rawComponent = ""] = project.split("/");
  const component = rawComponent.replace(/\.git$/, "");

  try {
    const url = new URL(projectPageUrl);
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
