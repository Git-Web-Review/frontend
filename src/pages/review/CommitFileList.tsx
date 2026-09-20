import { Fragment } from "react";
import { useI18n } from "../../i18n/I18nProvider";
import type { ReviewItem } from "../../types/api";
import { gitwebFileActions, type GitwebFileAction } from "./gitweb-links";
import { diffBlobHashes } from "./review-utils";

type DiffFile = ReviewItem["gitDiff"]["files"][number];

/** gitweb's own wording, in its own order, so the row reads the same. */
const fileActions: GitwebFileAction[] = [
  "blobdiff",
  "blob",
  "blame",
  "history",
];

const actionLabel: Record<GitwebFileAction, string> = {
  blobdiff: "diff",
  blob: "blob",
  blame: "blame",
  history: "history",
};

/**
 * The file list gitweb shows under a commit log: every file the commit
 * touches, each one linking back into gitweb.
 */
export function CommitFileList({
  gitwebUrl,
  commitHash,
  files,
}: {
  gitwebUrl: string;
  commitHash: string;
  files: DiffFile[];
}) {
  const { t } = useI18n();

  if (!files.length) {
    return null;
  }

  return (
    <details className="review-log-card commit-file-list-card" open>
      <summary className="card-header fw-semibold">
        <span className="d-inline-flex align-items-center gap-2">
          {t("commitFiles")}
          <span className="badge review-meta-badge">{files.length}</span>
          <i
            className="bi bi-chevron-down review-log-chevron"
            aria-hidden="true"
          />
        </span>
      </summary>
      <div className="commit-file-list">
        {files.map((file) => (
          <CommitFileRow
            commitHash={commitHash}
            file={file}
            gitwebUrl={gitwebUrl}
            key={file.path}
          />
        ))}
      </div>
    </details>
  );
}

function CommitFileRow({
  gitwebUrl,
  commitHash,
  file,
}: {
  gitwebUrl: string;
  commitHash: string;
  file: DiffFile;
}) {
  const { t } = useI18n();
  const { oldHash, newHash } = diffBlobHashes(file.patch);
  const actions = gitwebFileActions(gitwebUrl, commitHash, {
    path: file.path,
    oldPath: file.oldPath,
    status: file.status,
    oldHash,
    newHash,
  });

  return (
    <div className="commit-file-row">
      <span className="commit-file-path text-break">
        {actions.blob ? (
          <a
            className="commit-file-link"
            href={actions.blob}
            rel="noreferrer"
            target="_blank"
            title={t("gitwebFileLink", { action: actionLabel.blob })}
          >
            {file.path}
          </a>
        ) : (
          file.path
        )}
        {file.oldPath ? (
          <span className="commit-file-old-path d-block">{file.oldPath}</span>
        ) : null}
      </span>
      <span className="commit-file-actions">
        {fileActions.map((action, index) => {
          const href = actions[action];

          return (
            <Fragment key={action}>
              {index ? (
                <span className="commit-file-separator" aria-hidden="true">
                  |
                </span>
              ) : null}
              {href ? (
                <a
                  className="commit-file-link"
                  href={href}
                  rel="noreferrer"
                  target="_blank"
                  title={t("gitwebFileLink", { action: actionLabel[action] })}
                >
                  {actionLabel[action]}
                </a>
              ) : (
                <span className="commit-file-action-off">
                  {actionLabel[action]}
                </span>
              )}
            </Fragment>
          );
        })}
      </span>
    </div>
  );
}
