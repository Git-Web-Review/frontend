import { useI18n } from "../../i18n/I18nProvider";
import type { TranslationKey } from "../../i18n/translations";
import type { ReviewSyncPreview } from "../../types/api";
import { changeKindBadgeClass } from "./review-utils";

type SyncModalProps = {
  syncPreview: ReviewSyncPreview | null;
  loadingSyncPreview: boolean;
  syncCommitHashes: string[];
  syncingReview: boolean;
  onToggleCommit: (hash: string) => void;
  onClose: () => void;
  onApply: () => void;
};

export function SyncModal({
  syncPreview,
  loadingSyncPreview,
  syncCommitHashes,
  syncingReview,
  onToggleCommit,
  onClose,
  onApply,
}: SyncModalProps) {
  const { t } = useI18n();

  return (
    <>
      <div className="modal d-block" role="dialog" aria-modal="true">
        <div className="modal-dialog modal-lg">
          <div className="modal-content">
            <div className="modal-header">
              <div>
                <h5 className="modal-title">{t("syncReviewTitle")}</h5>
                {syncPreview?.sourceBranch ? (
                  <div className="small text-secondary text-break">
                    {syncPreview.sourceBranch}
                  </div>
                ) : null}
              </div>
              <button
                className="btn-close"
                type="button"
                aria-label="Close"
                onClick={onClose}
              />
            </div>
            <div className="modal-body">
              {loadingSyncPreview ? (
                <div className="d-flex align-items-center gap-2 text-secondary">
                  <span className="spinner-border spinner-border-sm" />
                  {t("loadingSyncPreview")}
                </div>
              ) : null}
              {syncPreview && !syncPreview.hasChanges ? (
                <div className="alert alert-info mb-0">
                  {t("syncNoChanges")}
                </div>
              ) : null}
              {syncPreview?.hasChanges ? (
                <>
                  <p className="text-secondary small mb-3">
                    {t("syncCreatesVersion")}{" "}
                    <span className="badge review-meta-badge">
                      v{syncPreview.version + 1}
                    </span>
                  </p>
                  <div className="list-group mb-3">
                    {syncPreview.commits.map((commit) => (
                      <label
                        className="list-group-item d-flex align-items-center gap-2"
                        key={commit.hash}
                      >
                        <input
                          checked={syncCommitHashes.includes(commit.hash)}
                          className="form-check-input flex-shrink-0 mt-0"
                          type="checkbox"
                          onChange={() => onToggleCommit(commit.hash)}
                        />
                        <span className="font-monospace small flex-shrink-0">
                          {commit.hash.slice(0, 12)}
                        </span>
                        <span className="text-truncate flex-grow-1">
                          {commit.title}
                        </span>
                        <span
                          className={`badge ${changeKindBadgeClass(commit.changeKind)} flex-shrink-0`}
                        >
                          {t(`changeKind${commit.changeKind}` as TranslationKey)}
                        </span>
                      </label>
                    ))}
                  </div>
                  {syncPreview.droppedCommits.length ? (
                    <>
                      <span className="form-label d-block">
                        {t("syncDroppedCommits")}
                      </span>
                      <div className="list-group">
                        {syncPreview.droppedCommits.map((commit) => (
                          <div
                            className="list-group-item d-flex align-items-center gap-2 text-secondary"
                            key={commit.hash}
                          >
                            <i
                              className="bi bi-x-circle flex-shrink-0"
                              aria-hidden="true"
                            />
                            <span className="font-monospace small flex-shrink-0">
                              {commit.hash.slice(0, 12)}
                            </span>
                            <span className="text-truncate flex-grow-1 text-decoration-line-through">
                              {commit.title}
                            </span>
                          </div>
                        ))}
                      </div>
                    </>
                  ) : null}
                </>
              ) : null}
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
                  !syncPreview?.hasChanges ||
                  syncCommitHashes.length === 0 ||
                  syncingReview
                }
                onClick={onApply}
              >
                {syncingReview ? (
                  <span className="spinner-border spinner-border-sm" />
                ) : (
                  <i className="bi bi-arrow-repeat" aria-hidden="true" />
                )}
                {t("syncApply")}
                {syncPreview ? ` v${syncPreview.version + 1}` : null}
              </button>
            </div>
          </div>
        </div>
      </div>
      <div className="modal-backdrop show" />
    </>
  );
}
