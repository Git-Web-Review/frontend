import type { ReactNode } from "react";
import { GitBranchIcon } from "../../components/GitBranchIcon";
import { ReviewerSearchSelect } from "../../components/ReviewerSearchSelect";
import { DateTimeText } from "../../components/DateTimeText";
import { useI18n } from "../../i18n/I18nProvider";
import { gitwebFetchErrorLabel } from "../../utils/gitwebFetchError";
import { projectName } from "../../utils/projectName";
import type {
  CommitLogLinkRule,
  ReviewField,
  ReviewItem,
  ReviewUserSummary,
} from "../../types/api";
import { linkedCommitLog } from "./gitweb-links";
import type { CommentTarget, ReviewCommentThread } from "./review-utils";

function CollapsibleDescription({
  review,
  collapsedDescription,
  expandedDescription,
  expanded,
  onToggle,
  commitLogLinkRules,
}: {
  review: ReviewItem;
  collapsedDescription: string;
  expandedDescription: string;
  expanded: boolean;
  onToggle: () => void;
  commitLogLinkRules: CommitLogLinkRule[];
}) {
  const { t } = useI18n();
  const canExpand = expandedDescription.length > 220;
  const visibleDescription = expanded
    ? expandedDescription
    : canExpand
      ? collapsedDescription.slice(0, 220).trimEnd()
      : collapsedDescription;

  return (
    <div
      className={
        expanded ? "review-description is-expanded" : "review-description"
      }
    >
      {visibleDescription
        ? linkedCommitLog(visibleDescription, review, commitLogLinkRules)
        : t("notAvailable")}
      {canExpand ? (
        <button
          className="description-ellipsis-button"
          type="button"
          aria-label={expanded ? t("collapseDescription") : t("expandDescription")}
          title={expanded ? t("collapseDescription") : t("expandDescription")}
          onClick={onToggle}
        >
          <i
            className={expanded ? "bi bi-chevron-up" : "bi bi-chevron-down"}
            aria-hidden="true"
          />
        </button>
      ) : null}
    </div>
  );
}

type OverviewTabPanelProps = {
  review: ReviewItem;
  idToken: string | null;
  canEditReviewDetails: boolean;
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
                <span className="review-readonly-value text-break">
                  {reviewTitleText}
                </span>
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
                <span className="review-readonly-value">
                  <CollapsibleDescription
                    review={review}
                    collapsedDescription={collapsedDescription}
                    expandedDescription={fullDescription}
                    expanded={descriptionExpanded}
                    onToggle={onToggleDescriptionExpanded}
                    commitLogLinkRules={commitLogLinkRules}
                  />
                </span>
              )}
            </dd>
          </dl>
          <div className="commit-summary-grid mt-3 mb-3">
            <div className="commit-summary-item commit-summary-project">
              <span className="commit-summary-icon">
                <i className="bi bi-box" aria-hidden="true" />
              </span>
              <span className="commit-summary-label">{t("sourceProject")}</span>
              <span className="commit-summary-value text-break">
                {projectName(review.sourceProject) || t("notAvailable")}
              </span>
            </div>
            <div className="commit-summary-item commit-summary-branch">
              <span className="commit-summary-icon">
                <GitBranchIcon />
              </span>
              <span className="commit-summary-label">{t("sourceBranch")}</span>
              <span className="commit-summary-value text-break">
                {sourceBranchLabelText}
              </span>
            </div>
            <div className="commit-summary-item commit-summary-hash">
              <span className="commit-summary-icon">
                <i className="bi bi-git" aria-hidden="true" />
              </span>
              <span className="commit-summary-label">{t("sourceCommit")}</span>
              <span className="commit-summary-value font-monospace text-break">
                {sourceCommitLabel || t("notAvailable")}
              </span>
            </div>
            <div className="commit-summary-item commit-summary-fetch">
              <span className="commit-summary-icon">
                <i className="bi bi-clock-history" aria-hidden="true" />
              </span>
              <span className="commit-summary-label">
                {t("gitwebFetchedAt")}
              </span>
              <span className="commit-summary-value">
                <DateTimeText
                  fallback={t("notAvailable")}
                  label={t("gitwebFetchedAt")}
                  value={review.gitwebFetchedAt}
                />
              </span>
            </div>
          </div>
          <dl className="row mb-0 small">
            <dt className="col-4">{t("gitwebUrl")}</dt>
            <dd className="col-8 text-break">
              <a href={review.gitwebUrl} rel="noreferrer" target="_blank">
                {review.gitwebUrl}
              </a>
            </dd>
            {review.gitwebFetchError ? (
              <>
                <dt className="col-4">{t("gitwebFetchError")}</dt>
                <dd className="col-8 text-danger text-break">
                  {gitwebFetchErrorLabel(review.gitwebFetchError, t)}
                </dd>
              </>
            ) : null}
            <dt className="col-4">{t("updatedAt")}</dt>
            <dd className="col-8">
              <DateTimeText label={t("updatedAt")} value={review.updatedAt} />
            </dd>
          </dl>
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
              disabled={!canEditReviewDetails}
              excludeUserIds={[review.ownerId]}
              idToken={idToken}
              label={t("reviewers")}
              selectedUserIds={reviewerUserIds}
              selectedUsers={review.reviewers.map((reviewer) => reviewer.user)}
              onChange={onReviewersChange}
            />
          </div>
          {reviewFieldDefs.length ? (
            <div className="mb-3">
              <span className="form-label d-block">{t("reviewFields")}</span>
              {reviewFieldDefs.map((field) => {
                const draft = fieldValueDrafts[field.id] ?? "";
                const saved = savedFieldValue(field.id);
                const changed = draft.trim() !== saved;
                const saving = savingFieldIds.includes(field.id);

                return (
                  <div className="mb-2" key={field.id}>
                    <label
                      className="form-label small mb-1"
                      htmlFor={`review-field-${field.id}`}
                    >
                      {field.name}
                    </label>
                    <div className="input-group input-group-sm">
                      {field.type === "TEXT" ? (
                        <textarea
                          className="form-control"
                          id={`review-field-${field.id}`}
                          disabled={!canEditReviewDetails}
                          placeholder={fieldPlaceholder(field.type)}
                          rows={3}
                          value={draft}
                          onChange={(event) =>
                            onFieldDraftChange(field.id, event.target.value)
                          }
                        />
                      ) : (
                        <input
                          className="form-control"
                          id={`review-field-${field.id}`}
                          disabled={!canEditReviewDetails}
                          placeholder={fieldPlaceholder(field.type)}
                          type={field.type === "NUMBER" ? "number" : "url"}
                          value={draft}
                          onChange={(event) =>
                            onFieldDraftChange(field.id, event.target.value)
                          }
                        />
                      )}
                      {canEditReviewDetails && changed ? (
                        <button
                          className="btn btn-outline-success d-inline-flex align-items-center gap-1"
                          type="button"
                          disabled={saving}
                          onClick={() => onSaveFieldValue(field.id)}
                        >
                          {saving ? (
                            <span className="spinner-border spinner-border-sm" />
                          ) : (
                            <i className="bi bi-save" aria-hidden="true" />
                          )}
                          {t("save")}
                        </button>
                      ) : null}
                    </div>
                    {saved && field.type === "LINK" ? (
                      <a
                        className="small text-break d-inline-flex align-items-center gap-1 mt-1"
                        href={saved}
                        rel="noreferrer"
                        target="_blank"
                      >
                        <i
                          className="bi bi-box-arrow-up-right"
                          aria-hidden="true"
                        />
                        {saved}
                      </a>
                    ) : null}
                    {saved && field.type === "IMAGE" ? (
                      <a
                        className="d-block mt-1"
                        href={saved}
                        rel="noreferrer"
                        target="_blank"
                      >
                        <img
                          alt={field.name}
                          className="review-field-image"
                          src={saved}
                        />
                      </a>
                    ) : null}
                  </div>
                );
              })}
            </div>
          ) : null}
        </div>
      </div>
      {hasReviewChanges && canEditReviewDetails ? (
        <div className="d-flex gap-2 mt-4">
          <button
            className="btn btn-success d-inline-flex align-items-center gap-2"
            disabled={savingReview}
            onClick={onSaveReview}
          >
            {savingReview ? (
              <span className="spinner-border spinner-border-sm" />
            ) : null}
            {t("saveReview")}
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
