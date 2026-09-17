import { useState } from "react";
import { apiRequest } from "../../../api/client";
import { useAuth } from "../../../auth/AuthProvider";
import type { ReviewComment } from "../../../types/api";
import { targetKey } from "../comment-threads";
import type { CommentDrafts } from "../comment-drafts";
import type { CommentTarget } from "../review-utils";
import type { ReviewData } from "./useReviewData";

/**
 * The composer for a new comment thread, open on one target at a time. One
 * draft per target: hiding a composer or opening another one keeps what was
 * typed, only Cancel and posting throw it away.
 */
export function useInlineComment(data: ReviewData, storedDrafts: CommentDrafts) {
  const { idToken } = useAuth();
  const { review } = data;
  const [inlineCommentTarget, setInlineCommentTarget] =
    useState<CommentTarget | null>(
      storedDrafts.openTargetKey
        ? storedDrafts.newComments[storedDrafts.openTargetKey].target
        : null,
    );
  const [newCommentDrafts, setNewCommentDrafts] = useState(
    storedDrafts.newComments,
  );
  const [savingComment, setSavingComment] = useState(false);

  const inlineCommentDraft = inlineCommentTarget
    ? (newCommentDrafts[targetKey(inlineCommentTarget)]?.message ?? "")
    : "";

  const updateInlineCommentDraft = (message: string) => {
    if (!inlineCommentTarget) {
      return;
    }

    const target = inlineCommentTarget;
    setNewCommentDrafts((current) => ({
      ...current,
      [targetKey(target)]: { target, message },
    }));
  };

  const discardNewCommentDraft = (target: CommentTarget) => {
    setNewCommentDrafts((current) =>
      Object.fromEntries(
        Object.entries(current).filter(([key]) => key !== targetKey(target)),
      ),
    );
  };

  const closeInlineComment = () => {
    if (inlineCommentTarget) {
      discardNewCommentDraft(inlineCommentTarget);
    }
    setInlineCommentTarget(null);
  };

  const toggleInlineComment = (target: CommentTarget) => {
    if (
      inlineCommentTarget &&
      targetKey(inlineCommentTarget) === targetKey(target)
    ) {
      setInlineCommentTarget(null);
      return;
    }

    setInlineCommentTarget(target);
  };

  const addInlineComment = async (message: string) => {
    const target = inlineCommentTarget;
    if (!target || !message) {
      return;
    }

    setSavingComment(true);
    data.setErrorMessage("");
    try {
      const comment =
        idToken && review
          ? await apiRequest<ReviewComment>(
              `/reviews/${review.id}/comments`,
              idToken,
              {
                method: "POST",
                body: JSON.stringify({ ...target, message }),
              },
            )
          : null;
      if (comment) {
        data.setReviewComments((current) => [...current, comment]);
        discardNewCommentDraft(target);
        setInlineCommentTarget(null);
        await data.refreshReviewSnapshot();
      }
    } catch (error) {
      data.reportError(error);
    } finally {
      setSavingComment(false);
    }
  };

  return {
    inlineCommentTarget,
    newCommentDrafts,
    savingComment,
    inlineCommentDraft,
    updateInlineCommentDraft,
    closeInlineComment,
    toggleInlineComment,
    addInlineComment,
  };
}

export type InlineComment = ReturnType<typeof useInlineComment>;
