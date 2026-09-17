import { useEffect, useState } from "react";
import { apiRequest } from "../../api/client";
import { useAuth } from "../../auth/AuthProvider";
import { useI18n } from "../../i18n/I18nProvider";
import type { TranslationKey } from "../../i18n/translations";
import { useConfirm } from "../../layout/ConfirmProvider";
import { useToast } from "../../layout/ToastProvider";
import type { ReviewDeletion, ReviewItem } from "../../types/api";
import { errorText, fieldPlaceholder } from "../review/review-display";
import { commitLogMatches, type DashboardSection } from "./dashboard-utils";
import { CreateReviewModal } from "./CreateReviewModal";
import { DASHBOARD_PANEL_ID, ReviewSection } from "./ReviewSection";
import { useCreateReview } from "./useCreateReview";
import { useReviewDashboard } from "./useReviewDashboard";

/**
 * The three review lists, as tabs. Order matches the sections the dashboard
 * has always shown: reviews you opened, reviews waiting on you, closed ones.
 */
const DASHBOARD_TABS: Array<{
  section: DashboardSection;
  icon: string;
  labelKey: TranslationKey;
  emptyKey: TranslationKey;
}> = [
  {
    section: "owned",
    icon: "bi-pencil-square",
    labelKey: "ownedReviews",
    emptyKey: "emptyOwned",
  },
  {
    section: "assigned",
    icon: "bi-inbox",
    labelKey: "assignedReviews",
    emptyKey: "emptyAssigned",
  },
  {
    section: "done",
    icon: "bi-check2-all",
    labelKey: "doneReviews",
    emptyKey: "emptyDone",
  },
];

/** Closes the open review actions menu on a click anywhere outside one. */
function useCloseReviewActionsOnOutsideClick(
  openReviewActionsId: string | null,
  close: () => void,
) {
  useEffect(() => {
    if (!openReviewActionsId) {
      return;
    }

    const closeReviewActions = (event: MouseEvent) => {
      const target = event.target;
      if (target instanceof Element && target.closest(".review-actions")) {
        return;
      }

      close();
    };

    document.addEventListener("mousedown", closeReviewActions);

    return () => document.removeEventListener("mousedown", closeReviewActions);
  }, [openReviewActionsId]);
}

export function DashboardPage() {
  const { currentUser, idToken } = useAuth();
  const { t } = useI18n();
  const { showToast } = useToast();
  const confirm = useConfirm();
  const [errorMessage, setErrorMessage] = useState("");
  const [activeSection, setActiveSection] = useState<DashboardSection>("owned");
  const [openReviewActionsId, setOpenReviewActionsId] = useState<string | null>(
    null,
  );
  const [deletingReviewId, setDeletingReviewId] = useState<string | null>(null);
  const reviews = useReviewDashboard(activeSection);
  const create = useCreateReview({
    onError: setErrorMessage,
    onCreated: reviews.loadDashboard,
  });

  useCloseReviewActionsOnOutsideClick(openReviewActionsId, () =>
    setOpenReviewActionsId(null),
  );

  const deleteReview = async (review: ReviewItem) => {
    if (!idToken || review.ownerId !== currentUser?.id) {
      return;
    }

    // Close the actions menu first so it does not linger behind the dialog.
    setOpenReviewActionsId(null);
    if (
      !(await confirm({
        title: t("confirmDeleteReviewTitle"),
        message: t("confirmDeleteReviewMessage"),
        confirmLabel: t("confirmDelete"),
        danger: true,
      }))
    ) {
      return;
    }

    setDeletingReviewId(review.id);
    setErrorMessage("");
    try {
      await apiRequest<ReviewDeletion>(`/reviews/${review.id}`, idToken, {
        method: "DELETE",
      });
      showToast(t("reviewDeleted"));
      await reviews.loadDashboard();
    } catch (error) {
      setErrorMessage(errorText(error, t));
    } finally {
      setDeletingReviewId(null);
    }
  };

  const activeTab =
    DASHBOARD_TABS.find((tab) => tab.section === activeSection) ??
    DASHBOARD_TABS[0];
  const { preview } = create;

  return (
    <div className="row g-4">
      <div className="col-12">
        <div className="card dashboard-create-card">
          <div className="card-header">
            <h3 className="card-title">{t("pasteGitweb")}</h3>
          </div>
          <div className="card-body">
            <div>
              <label className="form-label" htmlFor="gitweb-url">
                {t("gitwebUrl")}
              </label>
              <div className="input-group w-100">
                <span className="input-group-text">
                  <i className="bi bi-link-45deg" aria-hidden="true" />
                </span>
                <input
                  className="form-control"
                  id="gitweb-url"
                  value={create.gitwebUrl}
                  onChange={(event) => create.setGitwebUrl(event.target.value)}
                  placeholder={t("pasteGitwebPlaceholder")}
                />
                <button
                  className="btn btn-primary d-inline-flex align-items-center gap-2"
                  onClick={() => void create.previewReview()}
                  disabled={
                    !create.gitwebUrl || !idToken || create.previewLoading
                  }
                >
                  {create.previewLoading ? (
                    <span className="spinner-border spinner-border-sm" />
                  ) : (
                    <i className="bi bi-git" aria-hidden="true" />
                  )}
                  {t("createReview")}
                </button>
              </div>
            </div>
            {errorMessage ? (
              <div className="alert alert-danger mb-0 mt-3">{errorMessage}</div>
            ) : null}
          </div>
        </div>
      </div>

      <div className="col-12">
        <ul className="nav nav-tabs dashboard-tabs" role="tablist">
          {DASHBOARD_TABS.map((tab) => (
            <li className="nav-item" key={tab.section} role="presentation">
              <button
                aria-controls={DASHBOARD_PANEL_ID}
                aria-selected={activeSection === tab.section}
                className={
                  activeSection === tab.section ? "nav-link active" : "nav-link"
                }
                id={`dashboard-tab-${tab.section}`}
                role="tab"
                type="button"
                onClick={() => setActiveSection(tab.section)}
              >
                <i className={`bi ${tab.icon}`} aria-hidden="true" />
                {t(tab.labelKey)}
                <span className="badge">
                  {reviews.dashboard[tab.section].total}
                </span>
              </button>
            </li>
          ))}
        </ul>
        <ReviewSection
          key={activeTab.section}
          section={activeTab.section}
          emptyMessage={t(activeTab.emptyKey)}
          page={reviews.dashboard[activeTab.section]}
          loadingMore={reviews.loadingSections[activeTab.section]}
          hasMore={reviews.hasMoreReviews(activeTab.section)}
          loadMoreRef={reviews.loadMoreRefs[activeTab.section]}
          currentUserId={currentUser?.id}
          openReviewActionsId={openReviewActionsId}
          onToggleActions={(reviewId) =>
            setOpenReviewActionsId((currentId) =>
              currentId === reviewId ? null : reviewId,
            )
          }
          deletingReviewId={deletingReviewId}
          onDelete={(review) => void deleteReview(review)}
        />
      </div>

      {create.modalOpen && preview ? (
        <CreateReviewModal
          idToken={idToken}
          preview={preview}
          createTitle={create.title}
          onTitleChange={create.changeTitle}
          createCommitHashes={create.commitHashes}
          onToggleCommitHash={create.toggleCommitHash}
          createReviewerUserIds={create.reviewerUserIds}
          onReviewersChange={create.setReviewerUserIds}
          reviewFieldDefs={create.reviewFieldDefs}
          createFieldValues={create.fieldValues}
          onFieldValueChange={create.setFieldValue}
          fieldPlaceholder={(type) => fieldPlaceholder(type, t)}
          commitLogMatches={commitLogMatches(
            preview,
            create.commitLogLinkRules,
            t("commitLogMatch"),
          )}
          createLoading={create.createLoading}
          onClose={create.closeModal}
          onConfirm={() => void create.createReview()}
        />
      ) : null}
    </div>
  );
}
