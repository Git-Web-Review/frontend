import type { ReactNode } from "react";
import { UserAvatar } from "../../components/UserAvatar";
import { useI18n } from "../../i18n/I18nProvider";
import {
  CommentMessages,
  type CommentMessageActions,
} from "./CommentMessages";
import {
  CommentThreadControls,
  CommentThreadIdentityLine,
  CommentThreadSummary,
} from "./CommentThreadHeader";
import type { ThreadExpansion } from "./hooks/useThreadExpansion";
import { MarkdownView } from "./MarkdownView";
import { userLabel } from "./review-display";
import {
  threadReplies,
  threadRootMessage,
  type ReviewCommentThread,
} from "./review-utils";

type InlineCommentThreadsProps = {
  threads: ReviewCommentThread[];
  actions: CommentMessageActions;
  expansion: ThreadExpansion;
  canUpdateDone: boolean;
  savingDoneCommentIds: string[];
  onToggleDone: (thread: ReviewCommentThread) => void;
  newReplyCount: (thread: ReviewCommentThread) => number;
  renderReplyForm: (thread: ReviewCommentThread) => ReactNode;
};

/**
 * Same anatomy as the Discussion tab, tighter. A resolved thread folds into
 * a single line until it is opened again.
 */
export function InlineCommentThreads(props: InlineCommentThreadsProps) {
  return (
    <div className="diff-inline-comments">
      {props.threads.map((thread) => (
        <InlineCommentThread
          key={thread.commentId}
          thread={thread}
          {...props}
        />
      ))}
    </div>
  );
}

function InlineCommentThread({
  thread,
  actions,
  expansion,
  canUpdateDone,
  savingDoneCommentIds,
  onToggleDone,
  newReplyCount,
  renderReplyForm,
}: InlineCommentThreadsProps & { thread: ReviewCommentThread }) {
  const expanded = expansion.isCommentThreadExpanded(thread);
  const root = threadRootMessage(thread);
  const replies = threadReplies(thread);
  const resolvedRow = thread.done && !expanded;
  const toggle = () => expansion.toggleCommentThreadExpanded(thread);

  return (
    <div className={`diff-inline-comment${thread.done ? " is-done" : ""}`}>
      <div
        aria-expanded={expanded}
        className={`comment-thread-header${
          resolvedRow ? " is-resolved-row" : ""
        }`}
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
        {resolvedRow ? (
          <ResolvedThreadRow
            thread={thread}
            actions={actions}
            replyCount={replies.length}
          />
        ) : (
          <>
            <UserAvatar user={root.author} idToken={actions.idToken} />
            <div className="comment-thread-identity">
              <CommentThreadIdentityLine
                compact
                thread={thread}
                renderUserLabel={userLabel}
                showOpenedBy
              />
              {expanded ? null : (
                <CommentThreadSummary
                  thread={thread}
                  idToken={actions.idToken}
                  renderUserLabel={userLabel}
                />
              )}
            </div>
          </>
        )}
        <CommentThreadControls
          thread={thread}
          replyCount={replies.length}
          expanded={expanded}
          canUpdateDone={canUpdateDone && !resolvedRow}
          savingDone={savingDoneCommentIds.includes(thread.commentId)}
          shortDoneLabel
          onToggleDone={() => onToggleDone(thread)}
          onToggleExpanded={toggle}
        />
      </div>
      {expanded ? (
        <CommentMessages
          thread={thread}
          actions={actions}
          newReplyCount={newReplyCount(thread)}
          repliesExpanded={expansion.areRepliesExpanded(thread)}
          onToggleReplies={() => expansion.toggleRepliesExpanded(thread)}
          composer={renderReplyForm(thread)}
        />
      ) : null}
    </div>
  );
}

function ResolvedThreadRow({
  thread,
  actions,
  replyCount,
}: {
  thread: ReviewCommentThread;
  actions: CommentMessageActions;
  replyCount: number;
}) {
  const { t } = useI18n();
  const root = threadRootMessage(thread);

  return (
    <>
      <i className="bi bi-check2-circle" aria-hidden="true" />
      <UserAvatar user={root.author} idToken={actions.idToken} />
      <span className="comment-thread-author">
        {userLabel(root.author)}
      </span>{" "}
      <span className="comment-thread-excerpt markdown-body">
        <MarkdownView value={root.message} />
      </span>{" "}
      <span className="comment-thread-footer">
        {t("commentResolved").toLowerCase()}
        {replyCount
          ? ` · ${
              replyCount === 1
                ? t("commentReplyOne")
                : t("commentReplyMany", { count: replyCount })
            }`
          : ""}
      </span>
    </>
  );
}
