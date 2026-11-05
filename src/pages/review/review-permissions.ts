import type { CurrentUser, ReviewCommit, ReviewItem } from "../../types/api";

export type PermissionUser = Pick<CurrentUser, "id" | "role"> | null | undefined;

/** An admin, the review owner, or an owner of the review's project. */
export const canManageReview = (review: ReviewItem, user: PermissionUser) =>
  !!user &&
  (user.role === "ADMIN" ||
    review.ownerId === user.id ||
    review.projectOwnerIds.includes(user.id));

/** What the current user may do on the review, derived on every render. */
export const reviewPermissions = (
  review: ReviewItem | null,
  user: PermissionUser,
) => {
  const currentUserId = user?.id;
  const isOwner = !!review && canManageReview(review, user);
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
    // Reviewers can bring other reviewers in; only owners remove any.
    canAddReviewers: isOwner || !!currentReviewer,
    canUpdateCommentDone: isOwner || !!currentReviewer,
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
    canCloseReview: (isOwner || !!currentReviewer) && review?.status === "ACKED",
  };
};

export type ReviewPermissions = ReturnType<typeof reviewPermissions>;
