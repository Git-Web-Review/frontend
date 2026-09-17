import type { ReactNode } from "react";
import { UserAvatar } from "../../components/UserAvatar";
import { useI18n } from "../../i18n/I18nProvider";
import type { ReviewUserSummary } from "../../types/api";
import {
  CommentMessages,
  type CommentMessageActions,
} from "./CommentMessages";
import { CommentReplyForm } from "./CommentReplyForm";
import {
  CommentThreadControls,
  CommentThreadIdentityLine,
  CommentThreadSummary,
  CommentThreadTargetLine,
} from "./CommentThreadHeader";
import {
  commentThreadGroups,
  filteredCommentThreads,
  sortedCommentThreads,
  threadReplies,
  threadRootMessage,
  type DiscussionFilter,
  type DiscussionSort,
  type ReviewCommentThread,
} from "./review-utils";

type CommentsTabPanelProps = {
  threads: ReviewCommentThread[];
  currentUser: ReviewUserSummary | null;
  idToken: string | null;
  filter: DiscussionFilter;
  onFilterChange: (filter: DiscussionFilter) => void;
  sort: DiscussionSort;
  onSortChange: (sort: DiscussionSort) => void;
  isDiscussionExpanded: (thread: ReviewCommentThread) => boolean;
  onToggleDiscussion: (thread: ReviewCommentThread) => void;
  onExpandAll: (threads: ReviewCommentThread[]) => void;
  onCollapseAll: () => void;
  areRepliesExpanded: (thread: ReviewCommentThread) => boolean;
  onToggleReplies: (thread: ReviewCommentThread) => void;
  newReplyCount: (thread: ReviewCommentThread) => number;
  threadDiffAvailable: (thread: ReviewCommentThread) => boolean;
  onOpenDiffForThread: (thread: ReviewCommentThread) => void;
  renderUserLabel: (user: ReviewUserSummary) => string;
  messageActions: CommentMessageActions;
  threadTargetLabel: (thread: ReviewCommentThread) => string;
  canUpdateDone: boolean;
  savingDoneCommentIds: string[];
  onToggleDone: (thread: ReviewCommentThread, done: boolean) => void;
  replyDrafts: Record<string, string>;
  savingReplyCommentIds: string[];
  onReplyDraftChange: (commentId: string, value: string) => void;
  onSubmitReply: (thread: ReviewCommentThread) => void;
  onSubmitReplyAndResolve: (thread: ReviewCommentThread) => void;
};

export function CommentsTabPanel({
  threads,
  currentUser,
  idToken,
  filter,
  onFilterChange,
  sort,
  onSortChange,
  isDiscussionExpanded,
  onToggleDiscussion,
  onExpandAll,
  onCollapseAll,
  areRepliesExpanded,
  onToggleReplies,
  newReplyCount,
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
  onSubmitReplyAndResolve,
}: CommentsTabPanelProps) {
  const { t } = useI18n();

  const openCount = threads.filter((thread) => !thread.done).length;
  const doneCount = threads.length - openCount;
  const visibleThreads = filteredCommentThreads(threads, filter);
  const groups = commentThreadGroups(
    sortedCommentThreads(visibleThreads, sort),
  );
  const allExpanded =
    visibleThreads.length > 0 && visibleThreads.every(isDiscussionExpanded);

  const filterOptions: { value: DiscussionFilter; label: string; count: number }[] =
    [
      { value: "open", label: t("discussionFilterOpen"), count: openCount },
      { value: "done", label: t("discussionFilterDone"), count: doneCount },
      {
        value: "all",
        label: t("discussionFilterAll"),
        count: threads.length,
      },
    ];

  const conversationCount = (count: number) =>
    count === 1
      ? t("conversationCountOne")
      : t("conversationCountMany", { count });

  const renderThreadCard = (thread: ReviewCommentThread) => {
    const expanded = isDiscussionExpanded(thread);
    const replies = threadReplies(thread);

    const toggle = () => onToggleDiscussion(thread);

    return (
      <div
        className={`review-comment-card${thread.done ? " is-done" : ""}`}
        key={thread.commentId}
      >
        <div
          aria-expanded={expanded}
          className="comment-thread-header"
          role="button"
          tabIndex={0}
          onClick={toggle}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              toggle();
            }
          }}
        >
          <UserAvatar
            idToken={idToken}
            user={threadRootMessage(thread).author}
          />
          <div className="comment-thread-identity">
            <CommentThreadIdentityLine
              thread={thread}
              renderUserLabel={renderUserLabel}
              showOpenedBy={expanded}
            />
            <CommentThreadTargetLine
              thread={thread}
              targetLabel={threadTargetLabel(thread)}
              diffAvailable={threadDiffAvailable(thread)}
              onOpenDiff={() => onOpenDiffForThread(thread)}
            />
            {expanded ? null : (
              <CommentThreadSummary
                thread={thread}
                idToken={idToken}
                renderUserLabel={renderUserLabel}
                showParticipants={!thread.done}
              />
            )}
          </div>
          <CommentThreadControls
            thread={thread}
            replyCount={replies.length}
            expanded={expanded}
            canUpdateDone={canUpdateDone}
            savingDone={savingDoneCommentIds.includes(thread.commentId)}
            onToggleDone={() => onToggleDone(thread, !thread.done)}
            onToggleExpanded={toggle}
          />
        </div>

        {expanded ? (
          <CommentMessages
            thread={thread}
            actions={messageActions}
            newReplyCount={newReplyCount(thread)}
            repliesExpanded={areRepliesExpanded(thread)}
            onToggleReplies={() => onToggleReplies(thread)}
            composer={
              <CommentReplyForm
                draft={replyDrafts[thread.commentId] ?? ""}
                saving={savingReplyCommentIds.includes(thread.commentId)}
                currentUser={currentUser}
                idToken={idToken}
                canResolve={canUpdateDone && !thread.done}
                onDraftChange={(value) =>
                  onReplyDraftChange(thread.commentId, value)
                }
                onSubmit={() => onSubmitReply(thread)}
                onSubmitAndResolve={() => onSubmitReplyAndResolve(thread)}
              />
            }
          />
        ) : null}
      </div>
    );
  };

  const renderGroup = (
    key: string,
    filePath: string | null,
    groupThreads: ReviewCommentThread[],
  ): ReactNode => (
    <div className="discussion-group" key={key}>
      <div className="discussion-group-header">
        <i
          className={`bi ${filePath ? "bi-file-diff" : "bi-chat-left-text"}`}
          aria-hidden="true"
        />
        <span className="discussion-group-label" title={filePath ?? undefined}>
          {filePath ?? t("generalComments")}
        </span>
        <span className="discussion-group-rule" />{" "}
        <span className="discussion-group-count">
          {conversationCount(groupThreads.length)}
        </span>
      </div>
      <div className="discussion-list">{groupThreads.map(renderThreadCard)}</div>
    </div>
  );

  return (
    <div className="card-body">
      {threads.length ? (
        <>
          <div className="discussion-toolbar">
            <div className="discussion-filter" role="group">
              {filterOptions.map((option) => (
                <button
                  aria-pressed={filter === option.value}
                  className={`discussion-filter-option${
                    filter === option.value ? " is-active" : ""
                  }`}
                  key={option.value}
                  type="button"
                  onClick={() => onFilterChange(option.value)}
                >
                  {option.label}{" "}
                  <span className="discussion-filter-count">
                    {option.count}
                  </span>
                </button>
              ))}
            </div>
            <div className="discussion-toolbar-actions">
              <button
                className="discussion-toolbar-button"
                disabled={!visibleThreads.length}
                type="button"
                onClick={() =>
                  allExpanded ? onCollapseAll() : onExpandAll(visibleThreads)
                }
              >
                <i className="bi bi-chevron-expand" aria-hidden="true" />
                {allExpanded
                  ? t("collapseAllConversations")
                  : t("expandAllConversations")}
              </button>
              <button
                className="discussion-toolbar-button discussion-sort"
                title={t("sortConversations")}
                type="button"
                onClick={() =>
                  onSortChange(sort === "recent" ? "oldest" : "recent")
                }
              >
                {sort === "recent" ? t("sortRecentFirst") : t("sortOldestFirst")}
                <i className="bi bi-chevron-down" aria-hidden="true" />
              </button>
            </div>
          </div>

          {groups.length ? (
            groups.map((group) =>
              renderGroup(group.key, group.filePath, group.threads),
            )
          ) : (
            <div className="empty-state border rounded">{t("noComments")}</div>
          )}
        </>
      ) : (
        <div className="empty-state border rounded">{t("noComments")}</div>
      )}
    </div>
  );
}
