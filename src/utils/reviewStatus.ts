import type { ReviewStatus } from "../types/api";

const REVIEW_STATUS_BADGE_CLASSES: Record<ReviewStatus, string> = {
  PENDING: "text-bg-secondary",
  IN_REVIEW: "text-bg-info",
  ACKED: "text-bg-success",
  CLOSED: "text-bg-dark",
};

export const reviewStatusBadgeClass = (status: ReviewStatus) =>
  REVIEW_STATUS_BADGE_CLASSES[status];
