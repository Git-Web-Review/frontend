import type { RefObject } from "react";
import type { ReviewItem } from "../../types/api";
import { ReviewListItem } from "./ReviewListItem";
import type { DashboardSection } from "./dashboard-utils";

type DashboardPageData = {
  items: ReviewItem[];
  total: number;
};

type ReviewSectionProps = {
  section: DashboardSection;
  title: string;
  emptyMessage: string;
  page: DashboardPageData;
  loadingMore: boolean;
  hasMore: boolean;
  loadMoreRef: RefObject<HTMLDivElement | null>;
  className?: string;
  currentUserId: string | undefined;
  openReviewActionsId: string | null;
  onToggleActions: (reviewId: string) => void;
  deletingReviewId: string | null;
  onDelete: (review: ReviewItem) => void;
};

export function ReviewSection({
  section,
  title,
  emptyMessage,
  page,
  loadingMore,
  hasMore,
  loadMoreRef,
  className = "col-xl-6",
  currentUserId,
  openReviewActionsId,
  onToggleActions,
  deletingReviewId,
  onDelete,
}: ReviewSectionProps) {
  return (
    <div className={className}>
      <div className="card h-100">
        <div className="card-header dashboard-section-header d-flex align-items-center gap-3">
          <h3 className="card-title flex-grow-1 mb-0">{title}</h3>
          <span className="badge review-meta-badge ms-auto flex-shrink-0">
            {page.total}
          </span>
        </div>
        <div className="card-body p-0">
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
      </div>
    </div>
  );
}
