import { ReviewerSearchSelect } from "../../components/ReviewerSearchSelect";
import { useI18n } from "../../i18n/I18nProvider";
import { formatDateTime } from "../../utils/formatDate";
import { projectName } from "../../utils/projectName";
import { gitwebFetchErrorLabel } from "../../utils/gitwebFetchError";
import type {
  ReviewField,
  ReviewPreview,
} from "../../types/api";
import type { CommitLogMatch } from "./dashboard-utils";

type CreateReviewModalProps = {
  idToken: string | null;
  preview: ReviewPreview;
  createTitle: string;
  onTitleChange: (value: string) => void;
  createCommitHashes: string[];
  onToggleCommitHash: (hash: string) => void;
  createReviewerUserIds: string[];
  onReviewersChange: (userIds: string[]) => void;
  reviewFieldDefs: ReviewField[];
  createFieldValues: Record<string, string>;
  onFieldValueChange: (fieldId: string, value: string) => void;
  fieldPlaceholder: (type: ReviewField["type"]) => string;
  commitLogMatches: CommitLogMatch[];
  createLoading: boolean;
  onClose: () => void;
  onConfirm: () => void;
};

const shortHash = (value: string | null) => value?.slice(0, 12) ?? null;

const sourceBranchLabel = (value: string | null) => value || "master";

export function CreateReviewModal({
  idToken,
  preview,
  createTitle,
  onTitleChange,
  createCommitHashes,
  onToggleCommitHash,
  createReviewerUserIds,
  onReviewersChange,
  reviewFieldDefs,
  createFieldValues,
  onFieldValueChange,
  fieldPlaceholder,
  commitLogMatches,
  createLoading,
  onClose,
  onConfirm,
}: CreateReviewModalProps) {
  const { t } = useI18n();

  return (
    <>
      <div className="modal d-block" role="dialog" aria-modal="true">
        <div className="modal-dialog modal-xxl modal-dialog-scrollable">
          <div className="modal-content">
            <div className="modal-header">
              <div>
                <h5 className="modal-title">{t("reviewCreateDetails")}</h5>
                <div className="small text-secondary text-break">
                  {preview.gitwebUrl}
                </div>
              </div>
              <button
                className="btn-close"
                type="button"
                aria-label="Close"
                onClick={onClose}
              />
            </div>
            <div className="modal-body">
              {preview.gitwebFetchError ? (
                <div className="alert alert-warning">
                  {t("gitwebFetchError")}:{" "}
                  {gitwebFetchErrorLabel(preview.gitwebFetchError, t)}
                </div>
              ) : null}
              <div className="row g-4">
                <div className="col-lg-5">
                  {preview.title ? (
                    <h6 className="mb-3 text-break">{preview.title}</h6>
                  ) : null}
                  {preview.linkKind === "SUMMARY" ? (
                    <div className="border rounded">
                      <div className="d-flex align-items-center justify-content-between gap-2 border-bottom px-3 py-2">
                        <span className="fw-semibold">
                          {t("commitSelectionTitle")}
                        </span>
                        <span className="badge review-meta-badge">
                          {createCommitHashes.length}/
                          {preview.commitOptions.length}
                        </span>
                      </div>
                      {preview.commitOptions.length ? (
                        <div className="list-group list-group-flush commit-selection-list">
                          {preview.commitOptions.map((option) => (
                            <label
                              className="list-group-item d-flex align-items-start gap-2 commit-selection-item"
                              key={option.hash}
                            >
                              <input
                                checked={createCommitHashes.includes(
                                  option.hash,
                                )}
                                className="form-check-input mt-1 flex-shrink-0"
                                type="checkbox"
                                onChange={() => onToggleCommitHash(option.hash)}
                              />
                              <span className="d-flex flex-column">
                                <span className="text-break">
                                  {option.title}
                                </span>
                                <span className="small text-secondary font-monospace">
                                  {option.hash.slice(0, 12)}
                                  {option.authorName
                                    ? ` - ${option.authorName}`
                                    : ""}
                                </span>
                              </span>
                            </label>
                          ))}
                        </div>
                      ) : (
                        <div className="p-3 text-secondary">
                          {t("commitSelectionEmpty")}
                        </div>
                      )}
                    </div>
                  ) : preview.gitwebLog ? (
                    <pre className="border rounded bg-body-tertiary p-3 mb-0 review-log-body">
                      {preview.gitwebLog}
                    </pre>
                  ) : null}
                </div>
                <div className="col-lg-7">
                  <div className="mb-3">
                    <label className="form-label" htmlFor="create-review-title">
                      {t("reviewTitle")}
                    </label>
                    <input
                      className="form-control"
                      id="create-review-title"
                      type="text"
                      value={createTitle}
                      onChange={(event) => onTitleChange(event.target.value)}
                    />
                  </div>
                  <div className="commit-summary-grid mb-3">
                    <div className="commit-summary-item commit-summary-project">
                      <span className="commit-summary-icon">
                        <i className="bi bi-box" aria-hidden="true" />
                      </span>
                      <span className="commit-summary-label">
                        {t("sourceProject")}
                      </span>
                      <span className="commit-summary-value text-break">
                        {projectName(preview.sourceProject) ||
                          t("notAvailable")}
                      </span>
                    </div>
                    <div className="commit-summary-item commit-summary-branch">
                      <span className="commit-summary-icon">
                        <i className="bi bi-diagram-3" aria-hidden="true" />
                      </span>
                      <span className="commit-summary-label">
                        {t("sourceBranch")}
                      </span>
                      <span className="commit-summary-value text-break">
                        {sourceBranchLabel(preview.sourceBranch)}
                      </span>
                    </div>
                    <div className="commit-summary-item commit-summary-hash">
                      <span className="commit-summary-icon">
                        <i className="bi bi-git" aria-hidden="true" />
                      </span>
                      <span className="commit-summary-label">
                        {t("sourceCommit")}
                      </span>
                      <span className="commit-summary-value font-monospace text-break">
                        {shortHash(preview.sourceCommit) || t("notAvailable")}
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
                        {preview.gitwebFetchedAt
                          ? formatDateTime(preview.gitwebFetchedAt)
                          : t("notAvailable")}
                      </span>
                    </div>
                  </div>
                  {commitLogMatches.length ? (
                    <div className="commit-log-match-panel mb-3">
                      <div className="commit-log-match-title">
                        <i className="bi bi-stars" aria-hidden="true" />
                        {t("commitLogMatches")}
                      </div>
                      <div className="commit-log-match-list">
                        {commitLogMatches.map((match) => (
                          <a
                            className="commit-log-match-chip"
                            href={match.href}
                            key={match.key}
                            rel="noreferrer"
                            target="_blank"
                          >
                            <span className="commit-log-match-label">
                              {match.label}
                            </span>
                            <span className="commit-log-match-value">
                              {match.text}
                            </span>
                            <i
                              className="bi bi-box-arrow-up-right"
                              aria-hidden="true"
                            />
                          </a>
                        ))}
                      </div>
                    </div>
                  ) : null}
                  <div className="mb-3">
                    <ReviewerSearchSelect
                      idToken={idToken}
                      label={t("reviewers")}
                      selectedUserIds={createReviewerUserIds}
                      selectedUsers={preview.reviewerUsers}
                      onChange={onReviewersChange}
                    />
                  </div>
                  {reviewFieldDefs.length ? (
                    <div className="mb-3">
                      <span className="form-label d-block">
                        {t("reviewFields")}
                      </span>
                      {reviewFieldDefs.map((field) => (
                        <div className="mb-2" key={field.id}>
                          <label
                            className="form-label small mb-1"
                            htmlFor={`create-review-field-${field.id}`}
                          >
                            {field.name}
                          </label>
                          {field.type === "TEXT" ? (
                            <textarea
                              className="form-control form-control-sm"
                              id={`create-review-field-${field.id}`}
                              placeholder={fieldPlaceholder(field.type)}
                              rows={3}
                              value={createFieldValues[field.id] ?? ""}
                              onChange={(event) =>
                                onFieldValueChange(field.id, event.target.value)
                              }
                            />
                          ) : (
                            <input
                              className="form-control form-control-sm"
                              id={`create-review-field-${field.id}`}
                              placeholder={fieldPlaceholder(field.type)}
                              type={field.type === "NUMBER" ? "number" : "url"}
                              value={createFieldValues[field.id] ?? ""}
                              onChange={(event) =>
                                onFieldValueChange(field.id, event.target.value)
                              }
                            />
                          )}
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button
                className="btn btn-outline-secondary"
                type="button"
                onClick={onClose}
              >
                {t("cancel")}
              </button>
              <button
                className="btn btn-primary d-inline-flex align-items-center gap-2"
                type="button"
                disabled={
                  createLoading ||
                  (preview.linkKind === "SUMMARY" &&
                    createCommitHashes.length === 0)
                }
                onClick={onConfirm}
              >
                {createLoading ? (
                  <span className="spinner-border spinner-border-sm" />
                ) : (
                  <i className="bi bi-check2" aria-hidden="true" />
                )}
                {t("confirmCreateReview")}
              </button>
            </div>
          </div>
        </div>
      </div>
      <div className="modal-backdrop show" />
    </>
  );
}
