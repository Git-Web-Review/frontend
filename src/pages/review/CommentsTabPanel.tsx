import type { ReactNode } from "react";
import { DateTimeText } from "../../components/DateTimeText";
import { useI18n } from "../../i18n/I18nProvider";
import type { ReviewUserSummary } from "../../types/api";
import {
  CommentDoneMeta,
  CommentMessages,
  CommentReplyForm,
  CommentThreadControls,
  type CommentMessageActions,
} from "./CommentThreadParts";
import { MarkdownView } from "./MarkdownView";
import type { ReviewCommentThread } from "./review-utils";

type CommentsTabPanelProps = {
  threads: ReviewCommentThread[];
  isDiscussionExpanded: (thread: ReviewCommentThread) => boolean;
  onToggleDiscussion: (thread: ReviewCommentThread) => void;
  threadDiffAvailable: (thread: ReviewCommentThread) => boolean;
  onOpenDiffForThread: (thread: ReviewCommentThread) => void;
  renderUserLabel: (user: ReviewUserSummary) => ReactNode;
  messageActions: CommentMessageActions;
  threadTargetLabel: (thread: ReviewCommentThread) => string;
  canUpdateDone: boolean;
  savingDoneCommentIds: string[];
  onToggleDone: (thread: ReviewCommentThread, done: boolean) => void;
  replyDrafts: Record<string, string>;
  savingReplyCommentIds: string[];
  onReplyDraftChange: (commentId: string, value: string) => void;
  onSubmitReply: (thread: ReviewCommentThread) => void;
};

export function CommentsTabPanel({
  threads,
  isDiscussionExpanded,
  onToggleDiscussion,
  threadDiffAvailable,
  onOpenDiffForThread,
  renderUserLabel,
  messageActions,
  threadTargetLabel,
  canUpdateDone,
  savingDoneCommentIds,
  onToggleDone,
  replyDrafts,
  savingReplyCommentIds,
  onReplyDraftChange,
  onSubmitReply,
}: CommentsTabPanelProps) {
  const { t } = useI18n();

  return (
    <div className="card-body">
      {threads.length ? (
        <div className="timeline timeline-inverse mb-0">
          {threads.map((thread) => (
            <div className="time-label" key={thread.commentId}>
              <span className="review-meta-badge">
                <DateTimeText
                  label={t("createdAt")}
                  value={thread.createdAt}
                />
              </span>
              <div
                className={`card mt-2 review-comment-card${thread.done ? " is-done" : ""}`}
              >
                <div
                  aria-expanded={isDiscussionExpanded(thread)}
                  className="card-header d-flex justify-content-between gap-3 comment-thread-header"
                  role="button"
                  tabIndex={0}
                  onClick={() => onToggleDiscussion(thread)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      onToggleDiscussion(thread);
                    }
                  }}
                >
                  <span className="fw-semibold">
                    {renderUserLabel(thread.messages[0].author)}
                  </span>
                  <div className="d-flex flex-wrap align-items-center gap-2">
                    {threadDiffAvailable(thread) ? (
                      <button
                        className="btn btn-outline-primary btn-sm"
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          onOpenDiffForThread(thread);
                        }}
                      >
                        <i
                          className="bi bi-file-diff me-1"
                          aria-hidden="true"
                        />
                        {t("viewDiff")}
                      </button>
                    ) : null}
                    <CommentThreadControls
                      thread={thread}
                      showTargetLabel
                      targetLabel={threadTargetLabel(thread)}
                      canUpdateDone={canUpdateDone}
                      savingDone={savingDoneCommentIds.includes(
                        thread.commentId,
                      )}
                      onToggleDone={() => onToggleDone(thread, !thread.done)}
                    />
                  </div>
                </div>
                <div className="card-body review-comment-body">
                  {isDiscussionExpanded(thread) ? (
                    <>
                      <CommentMessages
                        thread={thread}
                        actions={messageActions}
                      />
                      <CommentDoneMeta
                        thread={thread}
                        renderUserLabel={renderUserLabel}
                      />
                      <CommentReplyForm
                        thread={thread}
                        draft={replyDrafts[thread.commentId] ?? ""}
                        saving={savingReplyCommentIds.includes(
                          thread.commentId,
                        )}
                        onDraftChange={(value) =>
                          onReplyDraftChange(thread.commentId, value)
                        }
                        onSubmit={() => onSubmitReply(thread)}
                      />
                    </>
                  ) : (
                    <div className="markdown-body">
                      <MarkdownView value={thread.messages[0].message} />
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="empty-state border rounded">{t("noComments")}</div>
      )}
    </div>
  );
}
