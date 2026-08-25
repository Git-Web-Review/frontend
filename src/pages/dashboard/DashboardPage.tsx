import { type RefObject, useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { apiRequest } from "../../api/client";
import { useAuth } from "../../auth/AuthProvider";
import { useI18n } from "../../i18n/I18nProvider";
import { useToast } from "../../layout/ToastProvider";
import { realtimeNotificationEvent } from "../../realtime/events";
import type {
  CommitLogLinkRule,
  ReviewDashboard,
  ReviewDeletion,
  ReviewField,
  ReviewItem,
  ReviewPreview,
} from "../../types/api";
import {
  commitLogMatches,
  dashboardLinkFromSearch,
  DASHBOARD_PAGE_SIZE,
  emptyDashboardPage,
  type CommitLogMatchSource,
  type DashboardSection,
} from "./dashboard-utils";
import { CreateReviewModal } from "./CreateReviewModal";
import { ReviewSection } from "./ReviewSection";

export function DashboardPage() {
  const { currentUser, idToken } = useAuth();
  const { t } = useI18n();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const dashboardLink = dashboardLinkFromSearch(location.search);
  const [gitwebUrl, setGitwebUrl] = useState("");
  const [createReviewerUserIds, setCreateReviewerUserIds] = useState<string[]>(
    [],
  );
  const [createCommitHashes, setCreateCommitHashes] = useState<string[]>([]);
  const [createTitle, setCreateTitle] = useState("");
  const [createTitleTouched, setCreateTitleTouched] = useState(false);

  const defaultCreateTitle = (
    currentPreview: ReviewPreview,
    selectedHashes: string[],
  ) => {
    const branch = currentPreview.sourceBranch?.trim();
    if (
      currentPreview.linkKind === "SUMMARY" &&
      branch &&
      branch !== "master"
    ) {
      return branch;
    }

    const oldestSelected = [...currentPreview.commitOptions]
      .reverse()
      .find((option) => selectedHashes.includes(option.hash));
    return oldestSelected?.title ?? currentPreview.title ?? "";
  };
  const [reviewFieldDefs, setReviewFieldDefs] = useState<ReviewField[]>([]);
  const [createFieldValues, setCreateFieldValues] = useState<
    Record<string, string>
  >({});
  const [commitLogLinkRules, setCommitLogLinkRules] = useState<
    CommitLogLinkRule[]
  >([]);
  const [preview, setPreview] = useState<ReviewPreview | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [createLoading, setCreateLoading] = useState(false);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [openReviewActionsId, setOpenReviewActionsId] = useState<string | null>(
    null,
  );
  const [deletingReviewId, setDeletingReviewId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [dashboard, setDashboard] = useState<ReviewDashboard>({
    owned: emptyDashboardPage(),
    assigned: emptyDashboardPage(),
    done: emptyDashboardPage(),
  });
  const [loadingDashboardSections, setLoadingDashboardSections] = useState<
    Record<DashboardSection, boolean>
  >({
    owned: false,
    assigned: false,
    done: false,
  });
  const ownedLoadMoreRef = useRef<HTMLDivElement | null>(null);
  const assignedLoadMoreRef = useRef<HTMLDivElement | null>(null);
  const doneLoadMoreRef = useRef<HTMLDivElement | null>(null);
  const processedLinkRef = useRef<string | null>(null);

  useEffect(() => {
    if (!openReviewActionsId) {
      return;
    }

    const closeReviewActions = (event: MouseEvent) => {
      const target = event.target;
      if (
        target instanceof Element &&
        target.closest(".review-actions")
      ) {
        return;
      }

      setOpenReviewActionsId(null);
    };

    document.addEventListener("mousedown", closeReviewActions);

    return () => document.removeEventListener("mousedown", closeReviewActions);
  }, [openReviewActionsId]);

  const dashboardQuery = (pages?: Partial<Record<DashboardSection, number>>) => {
    const params = new URLSearchParams({
      ownedPage: String(pages?.owned ?? 1),
      assignedPage: String(pages?.assigned ?? 1),
      donePage: String(pages?.done ?? 1),
      limit: String(DASHBOARD_PAGE_SIZE),
    });

    return params.toString();
  };

  const loadDashboard = async () => {
    if (!idToken) {
      return;
    }

    setDashboard(
      await apiRequest<ReviewDashboard>(
        `/v1/reviews/dashboard?${dashboardQuery()}`,
        idToken,
      ),
    );
  };

  const hasMoreReviews = (section: DashboardSection) =>
    dashboard[section].page < dashboard[section].totalPages;

  const loadNextDashboardPage = async (section: DashboardSection) => {
    if (!idToken || loadingDashboardSections[section] || !hasMoreReviews(section)) {
      return;
    }

    setLoadingDashboardSections((current) => ({
      ...current,
      [section]: true,
    }));
    try {
      const nextDashboard = await apiRequest<ReviewDashboard>(
        `/v1/reviews/dashboard?${dashboardQuery({
          [section]: dashboard[section].page + 1,
        })}`,
        idToken,
      );
      const nextPage = nextDashboard[section];
      setDashboard((current) => {
        const existingReviewIds = new Set(
          current[section].items.map((review) => review.id),
        );
        return {
          ...current,
          [section]: {
            ...nextPage,
            items: [
              ...current[section].items,
              ...nextPage.items.filter(
                (review) => !existingReviewIds.has(review.id),
              ),
            ],
          },
        };
      });
    } finally {
      setLoadingDashboardSections((current) => ({
        ...current,
        [section]: false,
      }));
    }
  };

  const loadCommitLogLinkRules = async () => {
    if (!idToken) {
      setCommitLogLinkRules([]);
      return;
    }

    try {
      setCommitLogLinkRules(
        await apiRequest<CommitLogLinkRule[]>(
          "/v1/commit-log-link-rules",
          idToken,
        ),
      );
    } catch {
      setCommitLogLinkRules([]);
    }
  };

  const loadReviewFieldDefs = async () => {
    if (!idToken) {
      setReviewFieldDefs([]);
      return;
    }

    try {
      setReviewFieldDefs(
        await apiRequest<ReviewField[]>("/v1/review-fields", idToken),
      );
    } catch {
      setReviewFieldDefs([]);
    }
  };

  useEffect(() => {
    void loadDashboard();
    void loadCommitLogLinkRules();
    void loadReviewFieldDefs();
  }, [idToken]);

  useEffect(() => {
    const refreshDashboard = () => {
      void loadDashboard();
    };

    window.addEventListener(realtimeNotificationEvent, refreshDashboard);
    return () => {
      window.removeEventListener(realtimeNotificationEvent, refreshDashboard);
    };
  }, [idToken]);

  useEffect(() => {
    if (!idToken || typeof IntersectionObserver === "undefined") {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) {
            continue;
          }

          const section = entry.target.getAttribute(
            "data-dashboard-section",
          ) as DashboardSection | null;
          if (section) {
            void loadNextDashboardPage(section);
          }
        }
      },
      { rootMargin: "180px" },
    );

    const targets: Array<[DashboardSection, HTMLDivElement | null]> = [
      ["owned", ownedLoadMoreRef.current],
      ["assigned", assignedLoadMoreRef.current],
      ["done", doneLoadMoreRef.current],
    ];

    for (const [section, target] of targets) {
      if (target && hasMoreReviews(section)) {
        observer.observe(target);
      }
    }

    return () => observer.disconnect();
  }, [idToken, dashboard, loadingDashboardSections]);

  const previewReview = async (nextGitwebUrl = gitwebUrl) => {
    const normalizedGitwebUrl = nextGitwebUrl.trim();
    if (!idToken || !normalizedGitwebUrl) {
      return;
    }

    setGitwebUrl(normalizedGitwebUrl);
    setErrorMessage("");
    setPreviewLoading(true);
    try {
      const nextPreview = await apiRequest<ReviewPreview>(
        "/v1/reviews/preview",
        idToken,
        {
          method: "POST",
          body: JSON.stringify({ gitwebUrl: normalizedGitwebUrl }),
        },
      );
      setPreview(nextPreview);
      setCreateReviewerUserIds(
        nextPreview.reviewerUsers.map((reviewer) => reviewer.id),
      );
      const selectedHashes = nextPreview.commitOptions.map(
        (option) => option.hash,
      );
      setCreateCommitHashes(selectedHashes);
      setCreateTitleTouched(false);
      setCreateTitle(defaultCreateTitle(nextPreview, selectedHashes));
      setCreateModalOpen(true);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : t("backendError"),
      );
    } finally {
      setPreviewLoading(false);
    }
  };

  useEffect(() => {
    if (!idToken || !dashboardLink || processedLinkRef.current === dashboardLink) {
      return;
    }

    processedLinkRef.current = dashboardLink;
    void previewReview(dashboardLink);
  }, [idToken, dashboardLink]);

  const createReview = async () => {
    if (!idToken || !preview) {
      return;
    }

    setErrorMessage("");
    setCreateLoading(true);
    try {
      const review = await apiRequest<ReviewItem>("/v1/reviews", idToken, {
        method: "POST",
        body: JSON.stringify({
          gitwebUrl: preview.gitwebUrl,
          reviewerUserIds: createReviewerUserIds,
          ...(createTitle.trim() ? { title: createTitle.trim() } : {}),
          ...(preview.linkKind === "SUMMARY"
            ? { commitHashes: createCommitHashes }
            : {}),
          fieldValues: Object.entries(createFieldValues)
            .map(([fieldId, value]) => ({ fieldId, value: value.trim() }))
            .filter((fieldValue) => fieldValue.value),
        }),
      });
      setGitwebUrl("");
      setCreateReviewerUserIds([]);
      setCreateCommitHashes([]);
      setCreateTitle("");
      setCreateFieldValues({});
      setPreview(null);
      setCreateModalOpen(false);
      showToast(t("reviewCreated"));
      await loadDashboard();
      navigate(`/review/${review.id}`);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : t("backendError"),
      );
    } finally {
      setCreateLoading(false);
    }
  };

  const closeCreateModal = () => {
    setCreateModalOpen(false);
  };

  const createFieldPlaceholder = (type: ReviewField["type"]) => {
    switch (type) {
      case "LINK":
        return t("fieldPlaceholderLink");
      case "IMAGE":
        return t("fieldPlaceholderImage");
      case "NUMBER":
        return t("fieldPlaceholderNumber");
      default:
        return t("fieldPlaceholderText");
    }
  };

  const toggleCreateCommitHash = (hash: string) => {
    setCreateCommitHashes((current) => {
      const nextSelection = current.includes(hash)
        ? current.filter((item) => item !== hash)
        : [...current, hash];
      if (preview && !createTitleTouched) {
        setCreateTitle(defaultCreateTitle(preview, nextSelection));
      }
      return nextSelection;
    });
  };

  const canDeleteReview = (review: ReviewItem) =>
    review.ownerId === currentUser?.id;

  const deleteReview = async (review: ReviewItem) => {
    if (!idToken || !canDeleteReview(review)) {
      return;
    }

    if (!window.confirm(t("confirmDeleteReview"))) {
      return;
    }

    setDeletingReviewId(review.id);
    setOpenReviewActionsId(null);
    setErrorMessage("");
    try {
      await apiRequest<ReviewDeletion>(`/v1/reviews/${review.id}`, idToken, {
        method: "DELETE",
      });
      showToast(t("reviewDeleted"));
      await loadDashboard();
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : t("backendError"),
      );
    } finally {
      setDeletingReviewId(null);
    }
  };

  const renderReviewSection = (
    section: DashboardSection,
    title: string,
    emptyMessage: string,
    loadMoreRef: RefObject<HTMLDivElement | null>,
    className = "col-xl-6",
  ) => (
    <ReviewSection
      section={section}
      title={title}
      emptyMessage={emptyMessage}
      page={dashboard[section]}
      loadingMore={loadingDashboardSections[section]}
      hasMore={hasMoreReviews(section)}
      loadMoreRef={loadMoreRef}
      className={className}
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
  );

  const previewCommitLogMatches = preview
    ? commitLogMatches(preview, commitLogLinkRules, t("commitLogMatch"))
    : [];

  return (
    <div className="row g-4">
      <div className="col-12">
        <div className="card card-primary card-outline">
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
                  value={gitwebUrl}
                  onChange={(event) => setGitwebUrl(event.target.value)}
                  placeholder={t("pasteGitwebPlaceholder")}
                />
                <button
                  className="btn btn-primary d-inline-flex align-items-center gap-2"
                  onClick={() => void previewReview()}
                  disabled={!gitwebUrl || !idToken || previewLoading}
                >
                  {previewLoading ? (
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

      {renderReviewSection(
        "owned",
        t("ownedReviews"),
        t("emptyOwned"),
        ownedLoadMoreRef,
      )}
      {renderReviewSection(
        "assigned",
        t("assignedReviews"),
        t("emptyAssigned"),
        assignedLoadMoreRef,
      )}
      {renderReviewSection(
        "done",
        t("doneReviews"),
        t("emptyDone"),
        doneLoadMoreRef,
        "col-12",
      )}

      {createModalOpen && preview ? (
        <CreateReviewModal
          idToken={idToken}
          preview={preview}
          createTitle={createTitle}
          onTitleChange={(value) => {
            setCreateTitleTouched(true);
            setCreateTitle(value);
          }}
          createCommitHashes={createCommitHashes}
          onToggleCommitHash={toggleCreateCommitHash}
          createReviewerUserIds={createReviewerUserIds}
          onReviewersChange={setCreateReviewerUserIds}
          reviewFieldDefs={reviewFieldDefs}
          createFieldValues={createFieldValues}
          onFieldValueChange={(fieldId, value) =>
            setCreateFieldValues((current) => ({
              ...current,
              [fieldId]: value,
            }))
          }
          fieldPlaceholder={createFieldPlaceholder}
          commitLogMatches={previewCommitLogMatches}
          createLoading={createLoading}
          onClose={closeCreateModal}
          onConfirm={() => void createReview()}
        />
      ) : null}
    </div>
  );
}
