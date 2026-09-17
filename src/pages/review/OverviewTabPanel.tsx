import type { ReactNode } from "react";
import { ReviewerSearchSelect } from "../../components/ReviewerSearchSelect";
import { useI18n } from "../../i18n/I18nProvider";
import type {
  CommitLogLinkRule,
  ReviewField,
  ReviewItem,
  ReviewUserSummary,
} from "../../types/api";
import { CollapsibleDescription } from "./CollapsibleDescription";
import { ReviewFieldValues } from "./ReviewFieldValues";
import { ReviewSourceSummary } from "./ReviewSourceSummary";
import type { CommentTarget, ReviewCommentThread } from "./review-utils";

type OverviewTabPanelProps = {
  review: ReviewItem;
  idToken: string | null;
  canEditReviewDetails: boolean;
  canAddReviewers: boolean;
  titleDraft: string;
  onTitleDraftChange: (value: string) => void;
  descriptionDraft: string;
  onDescriptionDraftChange: (value: string) => void;
  reviewTitleText: string;
  collapsedDescription: string;
  fullDescription: string;
  descriptionExpanded: boolean;
  onToggleDescriptionExpanded: () => void;
  commitLogLinkRules: CommitLogLinkRule[];
  sourceBranchLabelText: string;
  sourceCommitLabel: string | null;
  renderUserLabel: (user: ReviewUserSummary) => ReactNode;
  reviewerUserIds: string[];
  onReviewersChange: (userIds: string[]) => void;
  reviewFieldDefs: ReviewField[];
  fieldValueDrafts: Record<string, string>;
  onFieldDraftChange: (fieldId: string, value: string) => void;
  savedFieldValue: (fieldId: string) => string;
  fieldPlaceholder: (type: ReviewField["type"]) => string;
  savingFieldIds: string[];
  onSaveFieldValue: (fieldId: string) => void;
  hasReviewChanges: boolean;
  savingReview: boolean;
  onSaveReview: () => void;
  generalCommentTarget: CommentTarget;
  inlineCommentTarget: CommentTarget | null;
  targetKey: (target: CommentTarget) => string;
  toggleInlineComment: (target: CommentTarget) => void;
  renderInlineCommentComposer: () => ReactNode;
  renderInlineCommentThreads: (threads: ReviewCommentThread[]) => ReactNode;
  generalCommentThreads: ReviewCommentThread[];
};

export function OverviewTabPanel({
  review,
  idToken,
  canEditReviewDetails,
  canAddReviewers,
  titleDraft,
  onTitleDraftChange,
  descriptionDraft,
  onDescriptionDraftChange,
  reviewTitleText,
  collapsedDescription,
  fullDescription,
  descriptionExpanded,
  onToggleDescriptionExpanded,
  commitLogLinkRules,
  sourceBranchLabelText,
  sourceCommitLabel,
  renderUserLabel,
  reviewerUserIds,
  onReviewersChange,
  reviewFieldDefs,
  fieldValueDrafts,
  onFieldDraftChange,
  savedFieldValue,
  fieldPlaceholder,
  savingFieldIds,
  onSaveFieldValue,
  hasReviewChanges,
  savingReview,
  onSaveReview,
  generalCommentTarget,
  inlineCommentTarget,
  targetKey,
  toggleInlineComment,
  renderInlineCommentComposer,
  renderInlineCommentThreads,
  generalCommentThreads,
}: OverviewTabPanelProps) {
  const { t } = useI18n();

  return (
    <div className="card-body">
      <div className="row g-4">
        <div className="col-lg-7">
          <dl className="review-description-summary mb-0 small">
            <dt>{t("reviewTitle")}</dt>
            <dd>
              {canEditReviewDetails ? (
                <input
                  className="form-control form-control-sm"
                  type="text"
                  value={titleDraft}
                  onChange={(event) => onTitleDraftChange(event.target.value)}
                />
              ) : (
                <div className="review-readonly-value text-break">
                  {reviewTitleText}
                </div>
              )}
            </dd>
            <dt>{t("description")}</dt>
            <dd>
              {canEditReviewDetails ? (
                <textarea
                  className="form-control form-control-sm"
                  rows={4}
                  value={descriptionDraft}
                  onChange={(event) =>
                    onDescriptionDraftChange(event.target.value)
                  }
                />
              ) : (
                <div className="review-readonly-value">
                  <CollapsibleDescription
                    review={review}
                    collapsedDescription={collapsedDescription}
                    expandedDescription={fullDescription}
                    expanded={descriptionExpanded}
                    onToggle={onToggleDescriptionExpanded}
                    commitLogLinkRules={commitLogLinkRules}
                  />
                </div>
              )}
            </dd>
          </dl>
          <ReviewSourceSummary
            review={review}
            sourceBranchLabelText={sourceBranchLabelText}
            sourceCommitLabel={sourceCommitLabel}
          />
        </div>
        <div className="col-lg-5">
          <div className="mb-3">
            <span className="form-label d-block">{t("owner")}</span>
            <span className="badge text-bg-secondary">
              {renderUserLabel(review.owner)}
            </span>
          </div>
          <div className="mb-3">
            <ReviewerSearchSelect
              disabled={!canAddReviewers}
              excludeUserIds={[review.ownerId]}
              lockedUserIds={
                canEditReviewDetails
                  ? []
                  : review.reviewers.map((reviewer) => reviewer.userId)
              }
              idToken={idToken}
              label={t("reviewers")}
              selectedUserIds={reviewerUserIds}
              selectedUsers={review.reviewers.map((reviewer) => reviewer.user)}
              onChange={onReviewersChange}
            />
          </div>
          <ReviewFieldValues
            fields={reviewFieldDefs}
            canEdit={canEditReviewDetails}
            drafts={fieldValueDrafts}
            onDraftChange={onFieldDraftChange}
            savedValue={savedFieldValue}
            placeholder={fieldPlaceholder}
            savingFieldIds={savingFieldIds}
            onSave={onSaveFieldValue}
          />
        </div>
      </div>
      {hasReviewChanges && canAddReviewers ? (
        <div className="d-flex gap-2 mt-4">
          <button
            className="btn btn-success d-inline-flex align-items-center gap-2"
            disabled={savingReview}
            onClick={onSaveReview}
          >
            {savingReview ? (
              <span className="spinner-border spinner-border-sm" />
            ) : null}
            {t(canEditReviewDetails ? "saveReview" : "addReviewers")}
          </button>
        </div>
      ) : null}
      <div className="mt-4">
        <div className="d-flex align-items-center justify-content-between gap-3 mb-2">
          <h5 className="mb-0">
            <i className="bi bi-chat-left-text me-2" aria-hidden="true" />
            {t("reviewComments")}
          </h5>
          <button
            className="btn btn-outline-secondary btn-sm d-inline-flex align-items-center gap-2"
            type="button"
            onClick={() => toggleInlineComment(generalCommentTarget)}
          >
            <i className="bi bi-plus-lg" aria-hidden="true" />
            {t("commentReview")}
          </button>
        </div>
        {inlineCommentTarget &&
        targetKey(inlineCommentTarget) === targetKey(generalCommentTarget)
          ? renderInlineCommentComposer()
          : null}
        {generalCommentThreads.length ? (
          renderInlineCommentThreads(generalCommentThreads)
        ) : (
          <div className="empty-state border rounded">{t("noComments")}</div>
        )}
      </div>
    </div>
  );
}
