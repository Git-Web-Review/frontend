import type { ReactNode } from "react";
import { useI18n } from "../../i18n/I18nProvider";
import type { ReviewCommit, ReviewItem } from "../../types/api";
import { languageForPath } from "./diff-highlight";
import { diffLineClass, highlightedCode } from "./diff-line-highlight";
import { diffMetaLink, gitwebBlobUrl } from "./gitweb-links";
import {
  diffBlobHashes,
  diffRenderRows,
  type CommentTarget,
  type DiffBlobHashes,
  type ReviewCommentThread,
} from "./review-utils";

type DiffFile = ReviewItem["gitDiff"]["files"][number];

const renderDiffMetaLine = (
  line: string,
  gitwebUrl: string,
  file: DiffFile,
  hashes: DiffBlobHashes,
  commitHash: string,
): ReactNode | null => {
  const oldUrl = gitwebBlobUrl(gitwebUrl, file.oldPath ?? file.path, hashes.oldHash);
  const newUrl = gitwebBlobUrl(gitwebUrl, file.path, hashes.newHash, commitHash);

  const gitMatch = line.match(/^diff --git a\/(.+) b\/(.+)$/);
  if (gitMatch) {
    return (
      <>
        {"diff --git "}
        {diffMetaLink(oldUrl, `a/${gitMatch[1]}`)}{" "}
        {diffMetaLink(newUrl, `b/${gitMatch[2]}`)}
      </>
    );
  }

  if (line.startsWith("--- ")) {
    return diffMetaLink(oldUrl, line, "diff-meta-old");
  }

  if (line.startsWith("+++ ")) {
    return diffMetaLink(newUrl, line, "diff-meta-new");
  }

  return null;
};

const renderHunkHeaderContent = (
  line: string,
  gitwebUrl: string,
  file: DiffFile,
  hashes: DiffBlobHashes,
  commitHash: string,
): ReactNode => {
  const match = line.match(/^@@ -(\d+)((?:,\d+)?) \+(\d+)((?:,\d+)?) @@(.*)$/);
  if (!match) {
    return line;
  }

  const [, oldStart, oldCount, newStart, newCount, rest] = match;
  const oldUrl = gitwebBlobUrl(gitwebUrl, file.oldPath ?? file.path, hashes.oldHash);
  const newUrl = gitwebBlobUrl(gitwebUrl, file.path, hashes.newHash, commitHash);

  return (
    <>
      {"@@ "}
      {diffMetaLink(
        oldUrl ? `${oldUrl}#l${oldStart}` : null,
        `-${oldStart}${oldCount}`,
      )}{" "}
      {diffMetaLink(
        newUrl ? `${newUrl}#l${newStart}` : null,
        `+${newStart}${newCount}`,
      )}
      {" @@"}
      {rest}
    </>
  );
};

type DiffFileCardProps = {
  gitwebUrl: string;
  commit: ReviewCommit;
  file: DiffFile;
  expanded: boolean;
  onToggleExpanded: () => void;
  commentCount: number;
  viewed: boolean;
  canMarkViewed: boolean;
  savingViewed: boolean;
  onToggleViewed: () => void;
  threadsForTarget: (target: CommentTarget) => ReviewCommentThread[];
  isComposerOpen: (target: CommentTarget) => boolean;
  onToggleComment: (target: CommentTarget) => void;
  renderComposer: () => ReactNode;
  renderThreads: (threads: ReviewCommentThread[]) => ReactNode;
  anchorId: (target: CommentTarget) => string;
  onOpenLocation: (target: CommentTarget) => void;
};

export function DiffFileCard({
  gitwebUrl,
  commit,
  file,
  expanded,
  onToggleExpanded,
  commentCount,
  viewed,
  canMarkViewed,
  savingViewed,
  onToggleViewed,
  threadsForTarget,
  isComposerOpen,
  onToggleComment,
  renderComposer,
  renderThreads,
  anchorId,
  onOpenLocation,
}: DiffFileCardProps) {
  const { t } = useI18n();
  const rows = diffRenderRows(file.patch);
  const language = languageForPath(file.path);
  const blobHashes = diffBlobHashes(file.patch);
  const fileTarget = {
    commitHash: commit.hash,
    filePath: file.path,
    lineNumber: null,
    side: "AFTER",
  } satisfies CommentTarget;
  const fileCommentThreads = threadsForTarget(fileTarget);
  const fileComposerOpen = isComposerOpen(fileTarget);

  return (
    <div className="card mb-3" id={anchorId(fileTarget)}>
      <div
        aria-expanded={expanded}
        className="card-header py-1 d-flex align-items-center justify-content-between gap-3 diff-file-header"
        role="button"
        tabIndex={0}
        onClick={onToggleExpanded}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            onToggleExpanded();
          }
        }}
      >
        <div>
          <i
            className={`bi ${expanded ? "bi-chevron-down" : "bi-chevron-right"} me-2`}
            aria-hidden="true"
          />
          <span className="fw-semibold">{file.path}</span>
          <span className="badge text-bg-secondary ms-2">{file.status}</span>
          <span className="badge text-bg-success ms-2">+{file.additions}</span>
          <span className="badge text-bg-danger ms-1">-{file.deletions}</span>
          {!expanded && commentCount ? (
            <span
              className="badge review-meta-badge ms-2"
              title={t("fileComments")}
            >
              <i className="bi bi-chat-left-text me-1" aria-hidden="true" />
              {commentCount}
            </span>
          ) : null}
          {file.oldPath ? (
            <span className="d-block small text-secondary">{file.oldPath}</span>
          ) : null}
        </div>
        <div
          className="d-flex align-items-center gap-3"
          onClick={(event) => event.stopPropagation()}
          onKeyDown={(event) => event.stopPropagation()}
        >
          {canMarkViewed ? (
            <div className="form-check mb-0">
              <input
                checked={viewed}
                className="form-check-input"
                disabled={savingViewed}
                id={`file-viewed-${commit.id}:${file.path}`}
                type="checkbox"
                onChange={onToggleViewed}
              />
              <label
                className="form-check-label small"
                htmlFor={`file-viewed-${commit.id}:${file.path}`}
              >
                {t("fileViewed")}
              </label>
            </div>
          ) : null}
          <button
            className="btn btn-sm border-0 p-1"
            type="button"
            title={t("commentFile")}
            aria-label={t("commentFile")}
            onClick={() => onToggleComment(fileTarget)}
          >
            <i className="bi bi-chat-left-text" aria-hidden="true" />
          </button>
        </div>
      </div>
      {fileComposerOpen ? renderComposer() : null}
      {expanded ? renderThreads(fileCommentThreads) : null}
      {expanded ? (
        <div className="diff-viewer">
          {rows.map((row) => {
            if (row.kind === "hunk") {
              return (
                <div className="diff-line-block" key={row.key}>
                  <div className="diff-hunk-header">
                    {renderHunkHeaderContent(
                      row.text,
                      gitwebUrl,
                      file,
                      blobHashes,
                      commit.hash,
                    )}
                  </div>
                </div>
              );
            }

            if (row.lineNumber === null) {
              const metaContent = renderDiffMetaLine(
                row.text,
                gitwebUrl,
                file,
                blobHashes,
                commit.hash,
              );
              return (
                <div className="diff-line-block" key={row.key}>
                  <div className="diff-line diff-line-context diff-meta-line">
                    <code
                      className="diff-line-code hljs"
                      {...(metaContent
                        ? {}
                        : {
                            dangerouslySetInnerHTML: highlightedCode(
                              row.text,
                              language,
                            ),
                          })}
                    >
                      {metaContent}
                    </code>
                  </div>
                </div>
              );
            }

            const lineKind = diffLineClass(row.text);
            const lineTarget = {
              commitHash: commit.hash,
              filePath: file.path,
              lineNumber: row.lineNumber,
              side: row.side,
            } satisfies CommentTarget;
            const lineCommentThreads = threadsForTarget(lineTarget);
            const inlineComposerOpen = isComposerOpen(lineTarget);

            return (
              <div
                className="diff-line-block"
                id={anchorId(lineTarget)}
                key={row.key}
              >
                <div className={`diff-line ${lineKind}`}>
                  <button
                    className="diff-comment-button"
                    type="button"
                    title={t("commentLine")}
                    onClick={() => onToggleComment(lineTarget)}
                  >
                    <i className="bi bi-plus" aria-hidden="true" />
                  </button>
                  <button
                    className="diff-line-number diff-line-number-link"
                    type="button"
                    title={t("lineLink")}
                    onClick={() => onOpenLocation(lineTarget)}
                  >
                    {row.lineNumber ?? ""}
                  </button>
                  <code
                    className="diff-line-code hljs"
                    dangerouslySetInnerHTML={highlightedCode(row.text, language)}
                  />
                </div>
                {inlineComposerOpen ? renderComposer() : null}
                {renderThreads(lineCommentThreads)}
              </div>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
