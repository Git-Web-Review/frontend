import type { ReviewCommitStatus, ReviewStatus } from "../types/api";

// Workbench status pills: outline for pending, accent tint for in-review and
// acked, accent-2 tint for reviewed, neutral for closed. No filled labels.
const REVIEW_STATUS_BADGE_CLASSES: Record<ReviewStatus, string> = {
  PENDING: "review-status-badge is-pending",
  IN_REVIEW: "review-status-badge is-in-review",
  REVIEWED: "review-status-badge is-reviewed",
  ACKED: "review-status-badge is-acked",
  CLOSED: "review-status-badge is-closed",
};

const REVIEW_COMMIT_STATUS_BADGE_CLASSES: Record<ReviewCommitStatus, string> = {
  PENDING: "review-status-badge is-pending",
  IN_REVIEW: "review-status-badge is-in-review",
  REVIEWED: "review-status-badge is-reviewed",
  ACKED: "review-status-badge is-acked",
};

export const reviewStatusBadgeClass = (status: ReviewStatus) =>
  REVIEW_STATUS_BADGE_CLASSES[status];

export const reviewCommitStatusBadgeClass = (status: ReviewCommitStatus) =>
  REVIEW_COMMIT_STATUS_BADGE_CLASSES[status];
