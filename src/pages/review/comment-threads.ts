import type { ReviewComment } from "../../types/api";
import type { Translate } from "./review-display";
import type { CommentTarget, ReviewCommentThread } from "./review-utils";

export const targetKey = (target: CommentTarget) =>
  `${target.commitHash ?? ""}:${target.filePath ?? ""}:${target.lineNumber ?? ""}:${target.side}`;

export const diffAnchorId = (target: CommentTarget) =>
  `diff-anchor-${targetKey(target)}`;

const byCreatedAt = (
  left: { createdAt: string },
  right: { createdAt: string },
) => new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime();

export const sortedByCreatedAt = (comments: ReviewComment[]) =>
  [...comments].sort(byCreatedAt);

/** Groups messages into threads, both in the order they were written. */
export const commentThreadsFrom = (
  comments: ReviewComment[],
): ReviewCommentThread[] => {
  const threadsById = new Map<string, ReviewCommentThread>();

  for (const comment of sortedByCreatedAt(comments)) {
    const existingThread = threadsById.get(comment.commentId);
    if (existingThread) {
      existingThread.messages.push(comment);
      existingThread.done = comment.done;
      existingThread.doneBy = comment.doneBy;
      existingThread.doneAt = comment.doneAt;
      continue;
    }

    threadsById.set(comment.commentId, {
      commentId: comment.commentId,
      reviewId: comment.reviewId,
      commitHash: comment.commitHash,
      filePath: comment.filePath,
      lineNumber: comment.lineNumber,
      side: comment.side,
      done: comment.done,
      doneBy: comment.doneBy,
      doneAt: comment.doneAt,
      createdAt: comment.createdAt,
      messages: [comment],
    });
  }

  return [...threadsById.values()].sort(byCreatedAt);
};

export const commentThreadsForTarget = (
  comments: ReviewComment[],
  target: CommentTarget,
) =>
  commentThreadsFrom(
    comments.filter((comment) => targetKey(comment) === targetKey(target)),
  );

/** Distinct threads the messages belong to. */
export const threadCount = (comments: ReviewComment[]) =>
  new Set(comments.map((comment) => comment.commentId)).size;

export const commentTargetLabel = (target: CommentTarget, t: Translate) => {
  const commitPrefix = target.commitHash
    ? `${target.commitHash.slice(0, 12)} - `
    : "";

  if (!target.filePath) {
    if (target.commitHash) {
      return `${commitPrefix}${t("commitLogComment")}`;
    }
    return t("generalReviewComment");
  }

  if (target.lineNumber === null) {
    return `${commitPrefix}${target.filePath}`;
  }

  return `${commitPrefix}${target.filePath}:${target.lineNumber}${
    target.side === "BEFORE" ? ` (${t("commentSideBefore")})` : ""
  }`;
};
