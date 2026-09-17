import { useAuth } from "../../../auth/AuthProvider";
import { useI18n } from "../../../i18n/I18nProvider";
import type { ReviewItem } from "../../../types/api";
import type { CommentMessageActions } from "../CommentMessages";
import { CommentReplyForm } from "../CommentReplyForm";
import { InlineCommentComposer } from "../InlineCommentComposer";
import { InlineCommentThreads } from "../InlineCommentThreads";
import { MarkdownView } from "../MarkdownView";
import {
  commentRoleLabel,
  reviewUserSummaryOf,
  userLabel,
} from "../review-display";
import { threadNewReplyCount, type ReviewCommentThread } from "../review-utils";
import type { CommentActions } from "./useCommentActions";
import type { InlineComment } from "./useInlineComment";
import type { ThreadExpansion } from "./useThreadExpansion";

/**
 * The comment pieces the tab panels render: the new-comment composer, the
 * inline threads and what each message can do.
 */
export function useCommentRenderers({
  review,
  comments,
  inline,
  expansion,
  canUpdateCommentDone,
  lastSeenAt,
}: {
  review: ReviewItem | null;
  comments: CommentActions;
  inline: InlineComment;
  expansion: ThreadExpansion;
  canUpdateCommentDone: boolean;
  lastSeenAt: string | null;
}) {
  const { currentUser, idToken } = useAuth();
  const { t } = useI18n();
  const currentUserSummary = reviewUserSummaryOf(currentUser);

  const newReplyCount = (thread: ReviewCommentThread) =>
    threadNewReplyCount(thread, lastSeenAt, currentUser?.id);

  const messageActions: CommentMessageActions = {
    renderUserLabel: userLabel,
    idToken,
    roleLabel: (user) => commentRoleLabel(review, user, t),
    editingCommentId: comments.editingCommentId,
    editCommentDraft: comments.editCommentDraft,
    savingEditCommentIds: comments.savingEditCommentIds,
    deletingCommentIds: comments.deletingCommentIds,
    canEditComment: comments.canEditComment,
    canDeleteComment: comments.canDeleteComment,
    onStartEdit: comments.startEditComment,
    onCancelEdit: comments.cancelEditComment,
    onEditDraftChange: comments.setEditCommentDraft,
    onUpdateMessage: (comment) => void comments.updateCommentMessage(comment),
    onDeleteComment: (comment) => void comments.deleteComment(comment),
  };

  const renderInlineCommentComposer = () => (
    <InlineCommentComposer
      draft={inline.inlineCommentDraft}
      saving={inline.savingComment}
      labels={{
        placeholder: t("markdownCommentPlaceholder"),
        cancel: t("cancel"),
        submit: t("addComment"),
        previewEmpty: t("markdownPreviewEmpty"),
      }}
      renderMarkdown={(value) => <MarkdownView value={value} />}
      onDraftChange={inline.updateInlineCommentDraft}
      onCancel={inline.closeInlineComment}
      onSubmit={(message) => void inline.addInlineComment(message)}
    />
  );

  const renderReplyForm = (thread: ReviewCommentThread) => (
    <CommentReplyForm
      draft={comments.replyDrafts[thread.commentId] ?? ""}
      saving={comments.savingReplyCommentIds.includes(thread.commentId)}
      currentUser={currentUserSummary}
      idToken={idToken}
      compact
      canResolve={canUpdateCommentDone && !thread.done}
      onDraftChange={(value) => comments.setReplyDraft(thread.commentId, value)}
      onSubmit={() => void comments.addCommentReply(thread)}
      onSubmitAndResolve={() =>
        void comments.addCommentReply(thread, { resolve: true })
      }
    />
  );

  const renderInlineCommentThreads = (threads: ReviewCommentThread[]) =>
    threads.length ? (
      <InlineCommentThreads
        threads={threads}
        actions={messageActions}
        expansion={expansion}
        canUpdateDone={canUpdateCommentDone}
        savingDoneCommentIds={comments.savingDoneCommentIds}
        onToggleDone={(thread) =>
          void comments.updateCommentDone(thread, !thread.done)
        }
        newReplyCount={newReplyCount}
        renderReplyForm={renderReplyForm}
      />
    ) : null;

  return {
    currentUserSummary,
    newReplyCount,
    messageActions,
    renderInlineCommentComposer,
    renderInlineCommentThreads,
  };
}
