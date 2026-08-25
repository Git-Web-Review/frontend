import type { Dispatch, ReactNode, SetStateAction } from "react";
import { useI18n } from "../../i18n/I18nProvider";
import type { TranslationKey } from "../../i18n/translations";
import { reviewCommitStatusBadgeClass } from "../../utils/reviewStatus";
import type {
  CommitLogLinkRule,
  ReviewCommit,
  ReviewItem,
  ReviewUserSummary,
} from "../../types/api";
import { DiffFileCard } from "./DiffFileCard";
import { linkedCommitLog } from "./gitweb-links";
import { ReviewerActionSplit } from "./ReviewerActionSplit";
import {
  changeKindBadgeClass,
  type CommentTarget,
  type ReviewCommentThread,
} from "./review-utils";

type DiffFiles = ReviewItem["gitDiff"]["files"];

type FilesTabPanelProps = {
  review: ReviewItem;
  currentUserId: string | undefined;
  isReviewer: boolean;
  activeCommit: ReviewCommit | null;
  activeCommitIndex: number;
  activeCommitHasComments: boolean;
  commitLogTarget: CommentTarget | null;
  commitNavOpen: boolean;
  onToggleCommitNav: () => void;
  onSelectCommit: (commitId: string) => void;
  onScrollToNextComment: () => void;
  commitLogLinkRules: CommitLogLinkRule[];
  inlineCommentTarget: CommentTarget | null;
  targetKey: (target: CommentTarget) => string;
  commentThreadsForTarget: (target: CommentTarget) => ReviewCommentThread[];
  toggleInlineComment: (target: CommentTarget) => void;
  renderInlineCommentComposer: () => ReactNode;
  renderInlineCommentThreads: (threads: ReviewCommentThread[]) => ReactNode;
  diffAnchorId: (target: CommentTarget) => string;
  fileViewKey: (commitId: string, filePath: string) => string;
  isFileViewedByMe: (commit: ReviewCommit, filePath: string) => boolean;
  expandedFileKeys: Record<string, boolean>;
  setExpandedFileKeys: Dispatch<SetStateAction<Record<string, boolean>>>;
  savingFileViewKeys: string[];
  toggleFileViewed: (commit: ReviewCommit, filePath: string) => void;
  openDiffLocation: (target: CommentTarget) => void;
  commitDiffFiles: (commit: ReviewCommit) => DiffFiles;
  renderUserLabel: (user: ReviewUserSummary) => ReactNode;
  commitAckedByMe: (commit: ReviewCommit) => boolean;
  savingCommitAckIds: string[];
  unacknowledgeCommit: (commit: ReviewCommit) => void;
  commitActionMenuOpenId: string | null;
  setCommitActionMenuOpenId: (id: string | null) => void;
  canAckCommit: (commit: ReviewCommit) => boolean;
  canMarkCommitReviewed: (commit: ReviewCommit) => boolean;
  openCommentCountForCommit: (hash: string) => number;
  acknowledgeCommit: (commit: ReviewCommit) => void;
  markCommitReviewed: (commit: ReviewCommit) => void;
};

export function FilesTabPanel({
  review,
  currentUserId,
  isReviewer,
  activeCommit,
  activeCommitIndex,
  activeCommitHasComments,
  commitLogTarget,
  commitNavOpen,
  onToggleCommitNav,
  onSelectCommit,
  onScrollToNextComment,
  commitLogLinkRules,
  inlineCommentTarget,
  targetKey,
  commentThreadsForTarget,
  toggleInlineComment,
  renderInlineCommentComposer,
  renderInlineCommentThreads,
  diffAnchorId,
  fileViewKey,
  isFileViewedByMe,
  expandedFileKeys,
  setExpandedFileKeys,
  savingFileViewKeys,
  toggleFileViewed,
  openDiffLocation,
  commitDiffFiles,
  renderUserLabel,
  commitAckedByMe,
  savingCommitAckIds,
  unacknowledgeCommit,
  commitActionMenuOpenId,
  setCommitActionMenuOpenId,
  canAckCommit,
  canMarkCommitReviewed,
  openCommentCountForCommit,
  acknowledgeCommit,
  markCommitReviewed,
}: FilesTabPanelProps) {
  const { t } = useI18n();

  const commitChangeKindBadge = (commit: ReviewCommit) =>
    review.version > 1 && commit.changeKind ? (
      <span
        className={`badge ${changeKindBadgeClass(commit.changeKind)} flex-shrink-0`}
      >
        {t(`changeKind${commit.changeKind}` as TranslationKey)}
      </span>
    ) : null;

  const commitAckControls = (commit: ReviewCommit) => (
    <>
      {commit.acks.length ? (
        <span
          className="badge review-meta-badge flex-shrink-0"
          title={commit.acks
            .map((ack) => renderUserLabel(ack.user))
            .join(", ")}
        >
          <i className="bi bi-check2-circle me-1" aria-hidden="true" />
          {commit.acks.length}
        </span>
      ) : null}
      {isReviewer &&
      review.status !== "CLOSED" &&
      commitAckedByMe(commit) ? (
        <button
          className="btn btn-outline-warning btn-sm d-inline-flex align-items-center gap-1"
          disabled={savingCommitAckIds.includes(commit.id)}
          title={t("commitAckWithdrawn")}
          type="button"
          onClick={() => unacknowledgeCommit(commit)}
        >
          {savingCommitAckIds.includes(commit.id) ? (
            <span className="spinner-border spinner-border-sm" />
          ) : (
            <i className="bi bi-arrow-counterclockwise" aria-hidden="true" />
          )}
          {t("unackCommit")}
        </button>
      ) : null}
      {isReviewer &&
      review.status !== "CLOSED" &&
      commit.status !== "ACKED" &&
      !commitAckedByMe(commit) ? (
        <ReviewerActionSplit
          menuOpen={commitActionMenuOpenId === commit.id}
          setMenuOpen={(open) =>
            setCommitActionMenuOpenId(open ? commit.id : null)
          }
          saving={savingCommitAckIds.includes(commit.id)}
          canAck={canAckCommit(commit)}
          canReviewDone={canMarkCommitReviewed(commit)}
          preferReviewDone={openCommentCountForCommit(commit.hash) > 0}
          ackLabel={t("ackCommit")}
          onAck={() => acknowledgeCommit(commit)}
          onReviewDone={() => markCommitReviewed(commit)}
          small
        />
      ) : null}
    </>
  );

  return (
    <div className="card-body review-files-pane">
      {activeCommitHasComments ? (
        <button
          className="btn btn-primary next-comment-button d-inline-flex align-items-center gap-2"
          title={t("nextComment")}
          type="button"
          onClick={onScrollToNextComment}
        >
          <i className="bi bi-chat-left-text" aria-hidden="true" />
          <i className="bi bi-arrow-down" aria-hidden="true" />
          <span className="visually-hidden">{t("nextComment")}</span>
        </button>
      ) : null}
      {review.commits.length ? (
        <>
          {review.commits.length > 1 ? (
            <div className="review-commit-nav d-flex align-items-center gap-2 mb-3">
              <div className="dropdown position-relative flex-grow-1 min-w-0">
                <button
                  aria-expanded={commitNavOpen}
                  className="btn btn-outline-secondary w-100 d-flex align-items-center gap-2 review-commit-nav-toggle"
                  type="button"
                  onClick={onToggleCommitNav}
                >
                  <span className="badge review-meta-badge flex-shrink-0">
                    {activeCommitIndex + 1}/{review.commits.length}
                  </span>
                  <span className="font-monospace small flex-shrink-0">
                    {activeCommit?.hash.slice(0, 12)}
                  </span>
                  <span className="text-truncate flex-grow-1 text-start">
                    {activeCommit?.title}
                  </span>
                  {activeCommit ? commitChangeKindBadge(activeCommit) : null}
                  {activeCommit ? (
                    <span
                      className={`badge ${reviewCommitStatusBadgeClass(activeCommit.status)} flex-shrink-0`}
                    >
                      {t(`commitStatus${activeCommit.status}` as TranslationKey)}
                    </span>
                  ) : null}
                  <i
                    className={`bi ${commitNavOpen ? "bi-chevron-up" : "bi-chevron-down"} flex-shrink-0`}
                    aria-hidden="true"
                  />
                </button>
                {commitNavOpen ? (
                  <div className="dropdown-menu show w-100 review-commit-nav-menu">
                    {review.commits.map((commit, index) => (
                      <button
                        className={`dropdown-item d-flex align-items-center gap-2 review-commit-nav-item${
                          commit.id === activeCommit?.id ? " active" : ""
                        }`}
                        key={commit.id}
                        type="button"
                        onClick={() => onSelectCommit(commit.id)}
                      >
                        <span className="badge review-meta-badge flex-shrink-0">
                          {index + 1}/{review.commits.length}
                        </span>
                        <span className="font-monospace small flex-shrink-0">
                          {commit.hash.slice(0, 12)}
                        </span>
                        <span className="text-truncate flex-grow-1 text-start">
                          {commit.title}
                        </span>
                        {commitChangeKindBadge(commit)}
                        {commitAckedByMe(commit) ? (
                          <i
                            className="bi bi-check2-circle text-success flex-shrink-0"
                            aria-hidden="true"
                            title={t("commitAcked")}
                          />
                        ) : null}
                        <span
                          className={`badge ${reviewCommitStatusBadgeClass(commit.status)} flex-shrink-0`}
                        >
                          {t(`commitStatus${commit.status}` as TranslationKey)}
                        </span>
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
              {activeCommit ? commitAckControls(activeCommit) : null}
            </div>
          ) : null}
          {activeCommit ? (
            <>
              <div className="card mb-3">
                {review.commits.length === 1 ? (
                  <div className="card-header d-flex flex-wrap align-items-center justify-content-between gap-3">
                    <div className="d-flex flex-wrap align-items-center gap-2">
                      <span className="fw-semibold text-break">
                        {activeCommit.title}
                      </span>
                      <span className="font-monospace small text-secondary">
                        {activeCommit.hash.slice(0, 12)}
                      </span>
                      <span
                        className={`badge ${reviewCommitStatusBadgeClass(activeCommit.status)}`}
                      >
                        {t(`commitStatus${activeCommit.status}` as TranslationKey)}
                      </span>
                    </div>
                    <div className="d-flex flex-wrap align-items-center gap-2">
                      {commitAckControls(activeCommit)}
                    </div>
                  </div>
                ) : null}
                {activeCommit.rawMessage && commitLogTarget ? (
                  <details
                    className="review-log-card"
                    id={diffAnchorId(commitLogTarget)}
                    open
                  >
                    <summary className="card-header fw-semibold">
                      <span className="d-flex align-items-center justify-content-between gap-3">
                        <span className="d-inline-flex align-items-center gap-2">
                          {t("gitwebLog")}
                          <i
                            className="bi bi-chevron-down review-log-chevron"
                            aria-hidden="true"
                          />
                        </span>
                        <button
                          className="btn btn-sm border-0 p-1"
                          type="button"
                          title={t("commentCommitLog")}
                          aria-label={t("commentCommitLog")}
                          onClick={(event) => {
                            event.preventDefault();
                            event.stopPropagation();
                            toggleInlineComment(commitLogTarget);
                          }}
                        >
                          <i
                            className="bi bi-chat-left-text"
                            aria-hidden="true"
                          />
                        </button>
                      </span>
                    </summary>
                    <pre className="card-body mb-0 review-log-body">
                      {linkedCommitLog(
                        activeCommit.rawMessage,
                        review,
                        commitLogLinkRules,
                      )}
                    </pre>
                    {inlineCommentTarget &&
                    targetKey(inlineCommentTarget) ===
                      targetKey(commitLogTarget)
                      ? renderInlineCommentComposer()
                      : null}
                    {renderInlineCommentThreads(
                      commentThreadsForTarget(commitLogTarget),
                    )}
                  </details>
                ) : null}
              </div>
              {renderGitDiff(activeCommit, commitDiffFiles(activeCommit))}
            </>
          ) : null}
        </>
      ) : (
        <div className="empty-state border rounded">
          {t("diffNotAvailable")}
        </div>
      )}
    </div>
  );

  function renderGitDiff(commit: ReviewCommit, diffFiles: DiffFiles) {
    if (diffFiles.length === 0) {
      return (
        <div className="empty-state border rounded">
          {t("diffNotAvailable")}
        </div>
      );
    }

    return diffFiles.map((file) => {
      const viewKey = fileViewKey(commit.id, file.path);
      const viewed = isFileViewedByMe(commit, file.path);
      const fileExpanded = expandedFileKeys[viewKey] ?? !viewed;

      return (
        <DiffFileCard
          key={`${commit.hash}-${file.path}`}
          gitwebUrl={review.gitwebUrl}
          commit={commit}
          file={file}
          expanded={fileExpanded}
          onToggleExpanded={() =>
            setExpandedFileKeys((current) => ({
              ...current,
              [viewKey]: !fileExpanded,
            }))
          }
          viewed={viewed}
          canMarkViewed={review.ownerId === currentUserId || isReviewer}
          savingViewed={savingFileViewKeys.includes(viewKey)}
          onToggleViewed={() => toggleFileViewed(commit, file.path)}
          threadsForTarget={commentThreadsForTarget}
          isComposerOpen={(target) =>
            !!inlineCommentTarget &&
            targetKey(inlineCommentTarget) === targetKey(target)
          }
          onToggleComment={toggleInlineComment}
          renderComposer={renderInlineCommentComposer}
          renderThreads={renderInlineCommentThreads}
          anchorId={diffAnchorId}
          onOpenLocation={openDiffLocation}
        />
      );
    });
  }
}
