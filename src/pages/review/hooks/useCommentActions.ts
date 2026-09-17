import { useState } from "react";
import { apiRequest } from "../../../api/client";
import { useAuth } from "../../../auth/AuthProvider";
import { useI18n } from "../../../i18n/I18nProvider";
import { useConfirm } from "../../../layout/ConfirmProvider";
import { useToast } from "../../../layout/ToastProvider";
import type { ReviewComment, ReviewDeletion } from "../../../types/api";
import { withId, withoutId } from "../../../utils/idList";
import { sortedByCreatedAt } from "../comment-threads";
import type { CommentDrafts } from "../comment-drafts";
import type { ReviewCommentThread } from "../review-utils";
import type { ReviewData } from "./useReviewData";

const commentPath = (reviewId: string, commentId: string) =>
  `/reviews/${reviewId}/comments/${commentId}`;

/** Resolving, replying to, editing and deleting posted comments. */
export function useCommentActions(
  data: ReviewData,
  storedDrafts: CommentDrafts,
  canUpdateCommentDone: boolean,
) {
  const { currentUser, idToken } = useAuth();
  const { t } = useI18n();
  const { showToast } = useToast();
  const confirm = useConfirm();
  const { review, setReviewComments, refreshReviewSnapshot } = data;
  const [savingDoneCommentIds, setSavingDoneCommentIds] = useState<string[]>([]);
  const [deletingCommentIds, setDeletingCommentIds] = useState<string[]>([]);
  const [editingCommentId, setEditingCommentId] = useState<string | null>(
    storedDrafts.edit?.messageId ?? null,
  );
  const [editCommentDraft, setEditCommentDraft] = useState(
    storedDrafts.edit?.message ?? "",
  );
  const [savingEditCommentIds, setSavingEditCommentIds] = useState<string[]>(
    [],
  );
  const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>(
    storedDrafts.replies,
  );
  const [savingReplyCommentIds, setSavingReplyCommentIds] = useState<string[]>(
    [],
  );

  const isOwnComment = (comment: ReviewComment) =>
    comment.author.id === currentUser?.id;

  const replaceCommentThread = (comments: ReviewComment[]) => {
    const commentId = comments[0]?.commentId;
    if (!commentId) {
      return;
    }

    setReviewComments((current) =>
      sortedByCreatedAt([
        ...current.filter((comment) => comment.commentId !== commentId),
        ...comments,
      ]),
    );
  };

  const updateCommentDone = async (
    thread: ReviewCommentThread,
    done: boolean,
  ) => {
    if (!idToken || !review || !canUpdateCommentDone) {
      return;
    }

    setSavingDoneCommentIds((current) => withId(current, thread.commentId));
    data.setErrorMessage("");
    try {
      const comments = await apiRequest<ReviewComment[]>(
        commentPath(review.id, thread.commentId),
        idToken,
        { method: "PATCH", body: JSON.stringify({ done }) },
      );
      replaceCommentThread(comments);
      await refreshReviewSnapshot();
    } catch (error) {
      data.reportError(error);
    } finally {
      setSavingDoneCommentIds((current) =>
        withoutId(current, thread.commentId),
      );
    }
  };

  const cancelEditComment = () => {
    setEditingCommentId(null);
    setEditCommentDraft("");
  };

  const startEditComment = (comment: ReviewComment) => {
    setEditingCommentId(comment.id);
    setEditCommentDraft(comment.message);
  };

  const deleteComment = async (comment: ReviewComment) => {
    if (!idToken || !review || !isOwnComment(comment)) {
      return;
    }

    if (
      !(await confirm({
        title: t("confirmDeleteCommentTitle"),
        message: t("confirmDeleteCommentMessage"),
        confirmLabel: t("confirmDelete"),
        danger: true,
      }))
    ) {
      return;
    }

    setDeletingCommentIds((current) => withId(current, comment.id));
    data.setErrorMessage("");
    try {
      await apiRequest<ReviewDeletion>(
        `${commentPath(review.id, comment.commentId)}/messages/${comment.id}`,
        idToken,
        { method: "DELETE" },
      );
      if (editingCommentId === comment.id) {
        cancelEditComment();
      }
      setReviewComments((current) =>
        current.filter((currentComment) => currentComment.id !== comment.id),
      );
      await refreshReviewSnapshot();
      showToast(t("commentDeleted"));
    } catch (error) {
      data.reportError(error);
    } finally {
      setDeletingCommentIds((current) => withoutId(current, comment.id));
    }
  };

  const updateCommentMessage = async (comment: ReviewComment) => {
    const message = editCommentDraft.trim();
    if (!idToken || !review || !isOwnComment(comment) || !message) {
      return;
    }

    setSavingEditCommentIds((current) => withId(current, comment.id));
    data.setErrorMessage("");
    try {
      const comments = await apiRequest<ReviewComment[]>(
        `${commentPath(review.id, comment.commentId)}/messages/${comment.id}`,
        idToken,
        { method: "PATCH", body: JSON.stringify({ message }) },
      );
      replaceCommentThread(comments);
      cancelEditComment();
      showToast(t("commentUpdated"));
    } catch (error) {
      data.reportError(error);
    } finally {
      setSavingEditCommentIds((current) => withoutId(current, comment.id));
    }
  };

  const setReplyDraft = (commentId: string, value: string) =>
    setReplyDrafts((current) => ({ ...current, [commentId]: value }));

  const addCommentReply = async (
    thread: ReviewCommentThread,
    { resolve = false }: { resolve?: boolean } = {},
  ) => {
    const message = (replyDrafts[thread.commentId] ?? "").trim();
    if (!idToken || !review || !message) {
      return;
    }

    let replied = false;

    setSavingReplyCommentIds((current) => withId(current, thread.commentId));
    data.setErrorMessage("");
    try {
      const comments = await apiRequest<ReviewComment[]>(
        `${commentPath(review.id, thread.commentId)}/messages`,
        idToken,
        { method: "POST", body: JSON.stringify({ message }) },
      );
      replaceCommentThread(comments);
      setReplyDraft(thread.commentId, "");
      replied = true;
      if (!resolve) {
        await refreshReviewSnapshot();
      }
    } catch (error) {
      data.reportError(error);
    } finally {
      setSavingReplyCommentIds((current) =>
        withoutId(current, thread.commentId),
      );
    }

    // "Reply and resolve": the PATCH only goes out once the reply landed.
    if (replied && resolve) {
      await updateCommentDone(thread, true);
    }
  };

  return {
    savingDoneCommentIds,
    deletingCommentIds,
    editingCommentId,
    editCommentDraft,
    setEditCommentDraft,
    savingEditCommentIds,
    replyDrafts,
    setReplyDraft,
    savingReplyCommentIds,
    canEditComment: isOwnComment,
    canDeleteComment: isOwnComment,
    updateCommentDone,
    deleteComment,
    startEditComment,
    cancelEditComment,
    updateCommentMessage,
    addCommentReply,
  };
}

export type CommentActions = ReturnType<typeof useCommentActions>;
