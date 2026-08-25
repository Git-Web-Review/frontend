import { useNavigate } from "react-router-dom";
import { useI18n } from "../../i18n/I18nProvider";
import type { TranslationKey } from "../../i18n/translations";
import { formatDateTime } from "../../utils/formatDate";
import { projectName } from "../../utils/projectName";
import { reviewStatusBadgeClass } from "../../utils/reviewStatus";
import type { ReviewItem } from "../../types/api";

const reviewTitle = (review: ReviewItem) =>
  review.title ||
  review.gitwebTitle ||
  review.commits[0]?.title ||
  review.gitwebUrl;

const reviewerLabel = (reviewer: ReviewItem["reviewers"][number]) => {
  const displayName =
    reviewer.user.nickname || reviewer.user.hostname || reviewer.user.email;
  return displayName === reviewer.user.email
    ? displayName
    : `${displayName} <${reviewer.user.email}>`;
};

const shortHash = (value: string | null) => value?.slice(0, 12) ?? null;

const sourceBranchLabel = (value: string | null) => value || "master";

type ReviewListItemProps = {
  review: ReviewItem;
  canDelete: boolean;
  actionsOpen: boolean;
  onToggleActions: () => void;
  deleting: boolean;
  onDelete: () => void;
};

export function ReviewListItem({
  review,
  canDelete,
  actionsOpen,
  onToggleActions,
  deleting,
  onDelete,
}: ReviewListItemProps) {
  const { t } = useI18n();
  const navigate = useNavigate();

  const reviewersTooltip = review.reviewers.length
    ? review.reviewers.map(reviewerLabel).join("\n")
    : t("noReviewerOptions");

  return (
    <div className="list-group-item review-list-item">
      <button
        className="btn btn-link text-start text-body text-decoration-none p-0 w-100"
        type="button"
        onClick={() => navigate(`/review/${review.id}`)}
      >
        <div className="d-flex w-100 justify-content-between gap-3">
          <span className="fw-semibold text-break">{reviewTitle(review)}</span>
          <span
            className={`badge ${reviewStatusBadgeClass(
              review.status,
            )} align-self-start`}
          >
            {t(`reviewStatus${review.status}` as TranslationKey)}
          </span>
        </div>
        <div className="d-flex flex-wrap gap-2 small">
          {review.sourceProject ? (
            <span className="badge text-bg-primary">
              <i className="bi bi-folder2-open me-1" aria-hidden="true" />
              {projectName(review.sourceProject)}
            </span>
          ) : null}
          <span className="badge review-meta-badge">
            <i className="bi bi-diagram-3 me-1" aria-hidden="true" />
            {sourceBranchLabel(review.sourceBranch)}
          </span>
          {shortHash(review.sourceCommit) ? (
            <span className="badge review-meta-badge">
              <i className="bi bi-git me-1" aria-hidden="true" />
              {shortHash(review.sourceCommit)}
            </span>
          ) : null}
          {review.version > 1 ? (
            <span className="badge review-meta-badge" title={t("reviewVersion")}>
              <i className="bi bi-arrow-repeat me-1" aria-hidden="true" />
              v{review.version}
            </span>
          ) : null}
          {review.commits.length > 1 ? (
            <span className="badge review-meta-badge">
              <i className="bi bi-check2-circle me-1" aria-hidden="true" />
              {review.commits.filter((commit) => commit.status === "ACKED").length}
              /{review.commits.length} {t("commitsAckedProgress")}
            </span>
          ) : null}
          <span className="badge review-meta-badge" title={t("updatedAt")}>
            <i className="bi bi-clock-history me-1" aria-hidden="true" />
            {formatDateTime(review.updatedAt)}
          </span>
        </div>
      </button>
      <div className="d-flex flex-wrap align-items-end justify-content-between gap-2 small text-secondary mt-2">
        <div className="d-flex flex-column gap-1">
          <span>{review.owner.email}</span>
          <span>
            {review.commits.length} {t("commits")}{" "}
            <span aria-hidden="true">-</span>{" "}
            <span
              className="reviewers-count-tooltip"
              title={reviewersTooltip}
            >
              {review.reviewers.length} {t("reviewersCount")}
            </span>
          </span>
        </div>
        {canDelete ? (
          <div className="dropdown position-relative review-actions">
            <button
              aria-expanded={actionsOpen}
              aria-label={t("actions")}
              className="btn btn-link btn-sm review-actions-toggle"
              type="button"
              onClick={onToggleActions}
            >
              <i className="bi bi-three-dots" aria-hidden="true" />
            </button>
            {actionsOpen ? (
              <div className="dropdown-menu dropdown-menu-end show review-actions-menu">
                <button
                  className="dropdown-item text-danger d-flex align-items-center gap-2"
                  type="button"
                  disabled={deleting}
                  onClick={onDelete}
                >
                  {deleting ? (
                    <span className="spinner-border spinner-border-sm" />
                  ) : (
                    <i className="bi bi-trash" aria-hidden="true" />
                  )}
                  {t("deleteReview")}
                </button>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
