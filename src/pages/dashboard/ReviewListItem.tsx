import { useNavigate } from "react-router-dom";
import { GitBranchIcon } from "../../components/GitBranchIcon";
import { useI18n } from "../../i18n/I18nProvider";
import type { TranslationKey } from "../../i18n/translations";
import { formatDateTime, formatDateTimeLong } from "../../utils/formatDate";
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
  const { t, language } = useI18n();
  const navigate = useNavigate();

  const reviewersTooltip = review.reviewers.length
    ? review.reviewers.map(reviewerLabel).join("\n")
    : t("noReviewerOptions");
  const updatedTooltip = `${t("updatedAt")} — ${formatDateTimeLong(
    review.updatedAt,
    language,
  )}`;

  return (
    <div className="list-group-item review-list-item">
      <button
        className="review-row"
        type="button"
        onClick={() => navigate(`/review/${review.id}`)}
      >
        <div className="review-row-main">
          <span className="review-row-title text-break">
            {reviewTitle(review)}
          </span>
          <div className="review-row-meta">
            {review.sourceProject ? (
              <span
                className="review-repo-badge"
                title={review.sourceProject}
              >
                <i className="bi bi-folder2-open" aria-hidden="true" />
                <span className="review-repo-name">
                  {projectName(review.sourceProject)}
                </span>
              </span>
            ) : null}
            <span className="badge review-meta-badge">
              <GitBranchIcon className="me-1" />
              <span className="font-monospace">
                {sourceBranchLabel(review.sourceBranch)}
              </span>
            </span>
            {shortHash(review.sourceCommit) ? (
              <span className="badge review-meta-badge">
                <i className="bi bi-git me-1" aria-hidden="true" />
                <span className="font-monospace">
                  {shortHash(review.sourceCommit)}
                </span>
              </span>
            ) : null}
            {review.version > 1 ? (
              <span
                className="badge review-meta-badge"
                title={t("reviewVersion")}
              >
                <i className="bi bi-arrow-repeat me-1" aria-hidden="true" />
                v{review.version}
              </span>
            ) : null}
            {review.commits.length > 1 ? (
              <span className="badge review-meta-badge">
                <i className="bi bi-check2-circle me-1" aria-hidden="true" />
                {
                  review.commits.filter((commit) => commit.status === "ACKED")
                    .length
                }
                /{review.commits.length} {t("commitsAckedProgress")}
              </span>
            ) : null}
          </div>
          <div className="review-row-footer">
            <span>{review.owner.email}</span>
            <span aria-hidden="true">·</span>
            <span>
              {review.commits.length} {t("commits")}
            </span>
            <span aria-hidden="true">·</span>
            <span className="reviewers-count-tooltip" title={reviewersTooltip}>
              {review.reviewers.length} {t("reviewersCount")}
            </span>
          </div>
        </div>
        <div className="review-row-side">
          <span className={`badge ${reviewStatusBadgeClass(review.status)}`}>
            {t(`reviewStatus${review.status}` as TranslationKey)}
          </span>
          <span className="review-row-updated" title={updatedTooltip}>
            <i className="bi bi-clock-history" aria-hidden="true" />
            {formatDateTime(review.updatedAt)}
          </span>
        </div>
      </button>
      {canDelete ? (
        <div className="dropdown review-actions">
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
  );
}
