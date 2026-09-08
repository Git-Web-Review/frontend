import type { ReactNode } from "react";
import { DateTimeText } from "../../components/DateTimeText";
import { useI18n } from "../../i18n/I18nProvider";
import { reviewStatusBadgeClass } from "../../utils/reviewStatus";
import type { ReviewCommit, ReviewItem } from "../../types/api";
import { ReviewerActionSplit } from "./ReviewerActionSplit";
import type { ReviewTab } from "./review-utils";

type ReviewHeaderProps = {
  review: ReviewItem;
  currentUserId: string | undefined;
  isReviewer: boolean;
  title: string;
  ownerLabel: ReactNode;
  statusLabel: string;
  loadingReview: boolean;
  ackedCommitCount: number;
  activeTab: ReviewTab;
  onTabChange: (tab: ReviewTab) => void;
  totalDiffFileCount: number;
  commentThreadCount: number;
  commitAckedByMe: (commit: ReviewCommit) => boolean;
  reviewActionMenuOpen: boolean;
  setReviewActionMenuOpen: (open: boolean) => void;
  savingReviewAck: boolean;
  canAckReview: boolean;
  canMarkReviewReviewed: boolean;
  openCommentCount: number;
  onAcknowledgeReview: () => void;
  onMarkReviewReviewed: () => void;
  onUnacknowledgeReview: () => void;
  loadingSyncPreview: boolean;
  syncingReview: boolean;
  onOpenSyncModal: () => void;
  canCloseReview: boolean;
  closeReviewDisabledReason: string | undefined;
  savingCloseReview: boolean;
  onCloseReview: () => void;
  canDeleteReview: boolean;
  deletingReview: boolean;
  onDeleteReview: () => void;
};

export function ReviewHeader({
  review,
  currentUserId,
  isReviewer,
  title,
  ownerLabel,
  statusLabel,
  loadingReview,
  ackedCommitCount,
  activeTab,
  onTabChange,
  totalDiffFileCount,
  commentThreadCount,
  commitAckedByMe,
  reviewActionMenuOpen,
  setReviewActionMenuOpen,
  savingReviewAck,
  canAckReview,
  canMarkReviewReviewed,
  openCommentCount,
  onAcknowledgeReview,
  onMarkReviewReviewed,
  onUnacknowledgeReview,
  loadingSyncPreview,
  syncingReview,
  onOpenSyncModal,
  canCloseReview,
  closeReviewDisabledReason,
  savingCloseReview,
  onCloseReview,
  canDeleteReview,
  deletingReview,
  onDeleteReview,
}: ReviewHeaderProps) {
  const { t } = useI18n();

  return (
    <>
      <div className="d-flex flex-wrap align-items-center justify-content-end gap-3 mb-3">
        <div className="d-flex flex-wrap gap-2">
          <a
            className="btn btn-outline-primary d-inline-flex align-items-center"
            href={review.gitwebUrl}
            rel="noreferrer"
            target="_blank"
          >
            <i className="bi bi-box-arrow-up-right" aria-hidden="true" />
          </a>
          {isReviewer &&
          review.status !== "CLOSED" &&
          review.commits.some((commit) => !commitAckedByMe(commit)) ? (
            <ReviewerActionSplit
              menuOpen={reviewActionMenuOpen}
              setMenuOpen={setReviewActionMenuOpen}
              saving={savingReviewAck}
              canAck={canAckReview}
              canReviewDone={canMarkReviewReviewed}
              preferReviewDone={openCommentCount > 0}
              ackLabel={t("ackReview")}
              onAck={onAcknowledgeReview}
              onReviewDone={onMarkReviewReviewed}
            />
          ) : null}
          {isReviewer &&
          review.status !== "CLOSED" &&
          review.commits.some((commit) => commitAckedByMe(commit)) ? (
            <button
              className="btn btn-outline-warning d-inline-flex align-items-center gap-2"
              type="button"
              disabled={savingReviewAck}
              onClick={onUnacknowledgeReview}
            >
              {savingReviewAck ? (
                <span className="spinner-border spinner-border-sm" />
              ) : (
                <i
                  className="bi bi-arrow-counterclockwise"
                  aria-hidden="true"
                />
              )}
              {t("unackReview")}
            </button>
          ) : null}
          {review.ownerId === currentUserId && review.status !== "CLOSED" ? (
            <button
              className="btn btn-outline-secondary d-inline-flex align-items-center gap-2"
              type="button"
              disabled={loadingSyncPreview || syncingReview}
              onClick={onOpenSyncModal}
            >
              {loadingSyncPreview || syncingReview ? (
                <span className="spinner-border spinner-border-sm" />
              ) : (
                <i className="bi bi-arrow-repeat" aria-hidden="true" />
              )}
              {t("syncReview")}
            </button>
          ) : null}
          {review.ownerId === currentUserId && review.status !== "CLOSED" ? (
            <span
              className="disabled-button-tooltip"
              title={
                !canCloseReview || savingCloseReview
                  ? closeReviewDisabledReason
                  : undefined
              }
            >
              <button
                className="btn btn-success d-inline-flex align-items-center gap-2"
                type="button"
                disabled={!canCloseReview || savingCloseReview}
                onClick={onCloseReview}
              >
                {savingCloseReview ? (
                  <span className="spinner-border spinner-border-sm" />
                ) : (
                  <i className="bi bi-check2-all" aria-hidden="true" />
                )}
                {t("closeReview")}
              </button>
            </span>
          ) : null}
          {canDeleteReview ? (
            <button
              className="btn btn-outline-danger d-inline-flex align-items-center gap-2"
              type="button"
              disabled={deletingReview}
              onClick={onDeleteReview}
            >
              {deletingReview ? (
                <span className="spinner-border spinner-border-sm" />
              ) : (
                <i className="bi bi-trash" aria-hidden="true" />
              )}
              {t("deleteReview")}
            </button>
          ) : null}
        </div>
      </div>

      <div className="card-header border-bottom-0">
        <div className="d-flex flex-wrap align-items-start justify-content-between gap-3">
          <div>
            <h3 className="card-title review-header-title">{title}</h3>
            <div className="text-secondary small">
              {t("openedBy")} {ownerLabel} -{" "}
              <DateTimeText
                label={t("updatedAt")}
                value={review.updatedAt}
              />
            </div>
          </div>
          <div className="d-flex align-items-center gap-2">
            {loadingReview ? (
              <span className="spinner-border spinner-border-sm text-info" />
            ) : null}
            {review.commits.length > 1 ? (
              <span className="badge review-meta-badge">
                {ackedCommitCount}/{review.commits.length}{" "}
                {t("commitsAckedProgress")}
              </span>
            ) : null}
            <span className="badge review-meta-badge" title={t("reviewVersion")}>
              v{review.version}
            </span>
            <span className={`badge ${reviewStatusBadgeClass(review.status)}`}>
              {statusLabel}
            </span>
          </div>
        </div>
      </div>
      <div className="card-header p-0 border-bottom">
        <ul className="nav nav-tabs card-header-tabs px-3 pt-2">
          <li className="nav-item">
            <button
              className={
                activeTab === "overview" ? "nav-link active" : "nav-link"
              }
              type="button"
              onClick={() => onTabChange("overview")}
            >
              <i className="bi bi-info-circle me-1" aria-hidden="true" />
              {t("overview")}
            </button>
          </li>
          <li className="nav-item">
            <button
              className={activeTab === "files" ? "nav-link active" : "nav-link"}
              type="button"
              onClick={() => onTabChange("files")}
            >
              <i className="bi bi-file-diff me-1" aria-hidden="true" />
              {t("filesChanged")}
              <span className="badge text-bg-secondary ms-2">
                {totalDiffFileCount}
              </span>
            </button>
          </li>
          <li className="nav-item">
            <button
              className={
                activeTab === "comments" ? "nav-link active" : "nav-link"
              }
              type="button"
              onClick={() => onTabChange("comments")}
            >
              <i className="bi bi-chat-square-text me-1" aria-hidden="true" />
              {t("discussion")}
              <span className="badge text-bg-secondary ms-2">
                {commentThreadCount}
              </span>
            </button>
          </li>
        </ul>
      </div>
    </>
  );
}
