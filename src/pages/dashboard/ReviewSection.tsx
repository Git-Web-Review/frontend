import type { RefObject } from "react";
import type { ReviewItem } from "../../types/api";
import { ReviewListItem } from "./ReviewListItem";
import type { DashboardSection } from "./dashboard-utils";

type DashboardPageData = {
  items: ReviewItem[];
  total: number;
};

/** Shared by every tab: only the active section is mounted at a time. */
export const DASHBOARD_PANEL_ID = "dashboard-reviews-panel";

type ReviewSectionProps = {
  section: DashboardSection;
  emptyMessage: string;
  page: DashboardPageData;
  loadingMore: boolean;
  hasMore: boolean;
  loadMoreRef: RefObject<HTMLDivElement | null>;
  currentUserId: string | undefined;
  openReviewActionsId: string | null;
  onToggleActions: (reviewId: string) => void;
  deletingReviewId: string | null;
  onDelete: (review: ReviewItem) => void;
};

export function ReviewSection({
  section,
  emptyMessage,
  page,
  loadingMore,
  hasMore,
  loadMoreRef,
  currentUserId,
  openReviewActionsId,
  onToggleActions,
  deletingReviewId,
  onDelete,
}: ReviewSectionProps) {
  return (
    <div
      aria-labelledby={`dashboard-tab-${section}`}
      className="dashboard-panel"
      id={DASHBOARD_PANEL_ID}
      role="tabpanel"
      tabIndex={-1}
    >
      {page.items.length ? (
        <div className="list-group list-group-flush">
          {page.items.map((review) => (
            <ReviewListItem
              key={review.id}
              review={review}
              canDelete={review.ownerId === currentUserId}
              actionsOpen={openReviewActionsId === review.id}
              onToggleActions={() => onToggleActions(review.id)}
              deleting={deletingReviewId === review.id}
              onDelete={() => onDelete(review)}
            />
          ))}
        </div>
      ) : (
        <div className="empty-state">{emptyMessage}</div>
      )}
      {hasMore || loadingMore ? (
        <div
          className="d-flex justify-content-center py-3"
          data-dashboard-section={section}
          ref={loadMoreRef}
        >
          {loadingMore ? (
            <span className="spinner-border spinner-border-sm text-primary" />
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
