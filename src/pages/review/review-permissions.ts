import type { ReviewCommit, ReviewItem } from "../../types/api";

/** What the current user may do on the review, derived on every render. */
export const reviewPermissions = (
  review: ReviewItem | null,
  currentUserId: string | undefined,
) => {
  const isOwner = !!review && review.ownerId === currentUserId;
  const currentReviewer = review?.reviewers.find(
    (reviewer) => reviewer.userId === currentUserId,
  );
  const isOpen = review?.status !== "CLOSED";
  const commitAckedByMe = (commit: ReviewCommit) =>
    commit.acks.some((ack) => ack.userId === currentUserId);

  return {
    currentReviewer,
    canDeleteReview: isOwner,
    canEditReviewDetails: isOwner,
    // Reviewers can bring other reviewers in; only the owner removes any.
    canAddReviewers: isOwner || !!currentReviewer,
    canUpdateCommentDone:
      !!review &&
      (review.ownerId === currentUserId ||
        review.reviewers.some((reviewer) => reviewer.userId === currentUserId)),
    commitAckedByMe,
    canAckCommit: (commit: ReviewCommit) =>
      !!currentReviewer &&
      isOpen &&
      commit.status !== "ACKED" &&
      !commitAckedByMe(commit),
    canMarkCommitReviewed: (commit: ReviewCommit) =>
      !!currentReviewer &&
      isOpen &&
      commit.status !== "ACKED" &&
      commit.status !== "REVIEWED",
    canAckReview:
      !!currentReviewer &&
      !!review &&
      review.status !== "CLOSED" &&
      review.commits.some((commit) => !commitAckedByMe(commit)),
    canMarkReviewReviewed:
      !!currentReviewer &&
      !!review &&
      review.status !== "CLOSED" &&
      review.commits.some(
        (commit) => commit.status !== "ACKED" && commit.status !== "REVIEWED",
      ),
    canCloseReview: isOwner && review?.status === "ACKED",
  };
};

export type ReviewPermissions = ReturnType<typeof reviewPermissions>;
