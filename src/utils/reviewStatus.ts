import type { ReviewCommitStatus, ReviewStatus } from "../types/api";

const REVIEW_STATUS_BADGE_CLASSES: Record<ReviewStatus, string> = {
  PENDING: "review-status-badge text-bg-warning",
  IN_REVIEW: "review-status-badge text-bg-primary",
  REVIEWED: "review-status-badge text-bg-info",
  ACKED: "review-status-badge text-bg-success",
  CLOSED: "review-status-badge text-bg-secondary",
};

const REVIEW_COMMIT_STATUS_BADGE_CLASSES: Record<ReviewCommitStatus, string> = {
  PENDING: "review-status-badge text-bg-warning",
  IN_REVIEW: "review-status-badge text-bg-primary",
  REVIEWED: "review-status-badge text-bg-info",
  ACKED: "review-status-badge text-bg-success",
};

export const reviewStatusBadgeClass = (status: ReviewStatus) =>
  REVIEW_STATUS_BADGE_CLASSES[status];

export const reviewCommitStatusBadgeClass = (status: ReviewCommitStatus) =>
  REVIEW_COMMIT_STATUS_BADGE_CLASSES[status];
