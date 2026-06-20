import { type RefObject, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiRequest } from "../api/client";
import { useAuth } from "../auth/AuthProvider";
import { ReviewerSearchSelect } from "../components/ReviewerSearchSelect";
import { useI18n } from "../i18n/I18nProvider";
import { useToast } from "../layout/ToastProvider";
import { realtimeNotificationEvent } from "../realtime/events";
import type {
  CommitLogLinkRule,
  ReviewDashboard,
  ReviewDeletion,
  ReviewItem,
  ReviewPreview,
} from "../types/api";

type CommitLogMatchSource = {
  gitwebUrl: string;
  sourceCommit: string | null;
  gitwebLog: string | null;
};

type CommitLogMatch = {
  key: string;
  label: string;
  text: string;
  href: string;
  index: number;
};

type DashboardSection = "owned" | "assigned" | "done";

const DASHBOARD_PAGE_SIZE = 10;

const emptyDashboardPage = () => ({
  items: [],
  page: 1,
  limit: DASHBOARD_PAGE_SIZE,
  total: 0,
  totalPages: 0,
});

export function DashboardPage() {
  const { currentUser, idToken } = useAuth();
  const { t } = useI18n();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const [gitwebUrl, setGitwebUrl] = useState("");
  const [createTitle, setCreateTitle] = useState("");
  const [createDescription, setCreateDescription] = useState("");
  const [createReviewerUserIds, setCreateReviewerUserIds] = useState<string[]>(
    [],
  );
  const [commitLogLinkRules, setCommitLogLinkRules] = useState<
    CommitLogLinkRule[]
  >([]);
  const [preview, setPreview] = useState<ReviewPreview | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [createLoading, setCreateLoading] = useState(false);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [deletingReviewId, setDeletingReviewId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [expandedDescriptionReviewIds, setExpandedDescriptionReviewIds] =
    useState<string[]>([]);
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

  useEffect(() => {
    void loadDashboard();
    void loadCommitLogLinkRules();
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

  const nullableText = (value: string) => {
    const trimmed = value.trim();
    return trimmed ? trimmed : null;
  };

  const previewReview = async () => {
    if (!idToken || !gitwebUrl) {
      return;
    }

    setErrorMessage("");
    setPreviewLoading(true);
    try {
      const nextPreview = await apiRequest<ReviewPreview>(
        "/v1/reviews/preview",
        idToken,
        {
          method: "POST",
          body: JSON.stringify({ gitwebUrl }),
        },
      );
      setPreview(nextPreview);
      setCreateTitle(nextPreview.title ?? "");
      setCreateDescription(nextPreview.description ?? "");
      setCreateReviewerUserIds(
        nextPreview.reviewerUsers.map((reviewer) => reviewer.id),
      );
      setCreateModalOpen(true);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : t("backendError"),
      );
    } finally {
      setPreviewLoading(false);
    }
  };

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
          title: preview.title,
          description: preview.description,
          reviewerUserIds: createReviewerUserIds,
        }),
      });
      setGitwebUrl("");
      setCreateTitle("");
      setCreateDescription("");
      setCreateReviewerUserIds([]);
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

  const canDeleteReview = (review: ReviewItem) =>
    review.ownerId === currentUser?.id || currentUser?.role === "ADMIN";

  const deleteReview = async (review: ReviewItem) => {
    if (!idToken || !canDeleteReview(review)) {
      return;
    }

    if (!window.confirm(t("confirmDeleteReview"))) {
      return;
    }

    setDeletingReviewId(review.id);
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

  const reviewTitle = (review: ReviewItem) =>
    review.title ||
    review.gitwebTitle ||
    review.commits[0]?.title ||
    review.gitwebUrl;

  const reviewDescription = (review: ReviewItem) =>
    review.description ||
    review.gitwebLog ||
    review.commits[0]?.rawMessage ||
    "";

  const reviewerLabel = (reviewer: ReviewItem["reviewers"][number]) => {
    const displayName =
      reviewer.user.nickname || reviewer.user.hostname || reviewer.user.email;
    return displayName === reviewer.user.email
      ? displayName
      : `${displayName} <${reviewer.user.email}>`;
  };

  const reviewersTooltip = (review: ReviewItem) =>
    review.reviewers.length
      ? review.reviewers.map(reviewerLabel).join("\n")
      : t("noReviewerOptions");

  const isDescriptionExpanded = (reviewId: string) =>
    expandedDescriptionReviewIds.includes(reviewId);

  const toggleDescriptionExpanded = (reviewId: string) => {
    setExpandedDescriptionReviewIds((current) =>
      current.includes(reviewId)
        ? current.filter((currentReviewId) => currentReviewId !== reviewId)
        : [...current, reviewId],
    );
  };

  const shortHash = (value: string | null) => value?.slice(0, 12) ?? null;

  const sourceBranchLabel = (value: string | null) => value || "master";

  const gitwebParams = (currentGitwebUrl: string) => {
    const params = new Map<string, string>();
    const query = currentGitwebUrl.split("?")[1] ?? "";

    for (const segment of query.split(/[&;]/)) {
      const [key, ...valueParts] = segment.split("=");
      if (!key) {
        continue;
      }
      params.set(
        decodeURIComponent(key),
        decodeURIComponent(valueParts.join("=")),
      );
    }

    return params;
  };

  const gitwebTemplateVariables = (source: CommitLogMatchSource) => {
    const params = gitwebParams(source.gitwebUrl);
    const project = params.get("p") ?? "";
    const [username = "", rawComponent = ""] = project.split("/");
    const component = rawComponent.replace(/\.git$/, "");

    try {
      const url = new URL(source.gitwebUrl);
      return {
        USERNAME: username,
        HOSTNAME: url.hostname.replace(/\.dev\.6wind\.com$/, ""),
        COMPONENT: component,
        HASH: params.get("h") ?? source.sourceCommit ?? "",
      };
    } catch {
      return {
        USERNAME: username,
        HOSTNAME: "",
        COMPONENT: component,
        HASH: params.get("h") ?? source.sourceCommit ?? "",
      };
    }
  };

  const hrefFromRule = (
    rule: CommitLogLinkRule,
    match: RegExpExecArray,
    templateVariables: Record<string, string>,
  ) =>
    rule.linkTemplate.replace(/\$\{([^}]+)\}/g, (_token, groupName) => {
      const indexedGroup = Number(groupName);
      if (Number.isInteger(indexedGroup)) {
        return match[indexedGroup] ?? "";
      }

      return match.groups?.[groupName] ?? templateVariables[groupName] ?? "";
    });

  const commitLogMatches = (source: CommitLogMatchSource): CommitLogMatch[] => {
    const text = source.gitwebLog ?? "";
    const templateVariables = gitwebTemplateVariables(source);
    const matches: CommitLogMatch[] = [];
    const seenMatches = new Set<string>();

    for (const rule of commitLogLinkRules) {
      if (!rule.enabled) {
        continue;
      }

      try {
        const regex = new RegExp(rule.regex, "g");
        let match: RegExpExecArray | null;
        while ((match = regex.exec(text))) {
          if (match[0].length === 0) {
            regex.lastIndex += 1;
            continue;
          }

          const href = hrefFromRule(rule, match, templateVariables);
          const key = `${rule.id}:${match.index}:${match[0]}:${href}`;
          if (seenMatches.has(key)) {
            continue;
          }

          seenMatches.add(key);
          matches.push({
            key,
            label: rule.label || t("commitLogMatch"),
            text: match[0],
            href,
            index: match.index,
          });
        }
      } catch {
        continue;
      }
    }

    return matches.sort((left, right) => left.index - right.index);
  };

  const renderReview = (review: ReviewItem) => (
    <div
      className="list-group-item review-list-item"
      key={review.id}
    >
      <button
        className="btn btn-link text-start text-body text-decoration-none p-0 w-100"
        type="button"
        onClick={() => navigate(`/review/${review.id}`)}
      >
        <div className="d-flex w-100 justify-content-between gap-3">
          <span className="fw-semibold text-break">{reviewTitle(review)}</span>
          <span className="badge text-bg-primary align-self-start">
            {t(`reviewStatus${review.status}`)}
          </span>
        </div>
        <div className="d-flex flex-wrap gap-2 small">
          {review.sourceProject ? (
            <span className="badge text-bg-light border">
              <i className="bi bi-folder2-open me-1" aria-hidden="true" />
              {review.sourceProject}
            </span>
          ) : null}
          <span className="badge text-bg-light border">
            <i className="bi bi-diagram-3 me-1" aria-hidden="true" />
            {sourceBranchLabel(review.sourceBranch)}
          </span>
          {shortHash(review.sourceCommit) ? (
            <span className="badge text-bg-light border">
              <i className="bi bi-git me-1" aria-hidden="true" />
              {shortHash(review.sourceCommit)}
            </span>
          ) : null}
        </div>
      </button>
      {reviewDescription(review) ? (() => {
        const description = reviewDescription(review);
        const expanded = isDescriptionExpanded(review.id);
        const canExpand = description.length > 220;
        const visibleDescription =
          canExpand && !expanded
            ? description.slice(0, 220).trimEnd()
            : description;

        return (
          <p className={expanded ? "review-list-description is-expanded mb-2 text-secondary" : "review-list-description mb-2 text-secondary"}>
            {visibleDescription}
            {canExpand ? (
              <button
                className="description-ellipsis-button"
                type="button"
                aria-label={expanded ? t("collapseDescription") : t("expandDescription")}
                title={expanded ? t("collapseDescription") : t("expandDescription")}
                onClick={() => toggleDescriptionExpanded(review.id)}
              >
                {expanded ? t("collapseDescription") : "..."}
              </button>
            ) : null}
          </p>
        );
      })() : null}
      <div className="d-flex flex-wrap align-items-end justify-content-between gap-2 small text-secondary mt-2">
        <div className="d-flex flex-column gap-1">
          <span>{review.owner.email}</span>
          <span>
            {review.commits.length} {t("commits")} <span aria-hidden="true">-</span>{" "}
            <span
              className="reviewers-count-tooltip"
              title={reviewersTooltip(review)}
            >
              {review.reviewers.length} {t("reviewersCount")}
            </span>
          </span>
        </div>
        {canDeleteReview(review) ? (
          <button
            aria-label={t("deleteReview")}
            className="btn btn-outline-danger btn-sm review-delete-button"
            title={t("deleteReview")}
            type="button"
            disabled={deletingReviewId === review.id}
            onClick={() => void deleteReview(review)}
          >
            {deletingReviewId === review.id ? (
              <span className="spinner-border spinner-border-sm" />
            ) : (
              <i className="bi bi-trash" aria-hidden="true" />
            )}
          </button>
        ) : null}
      </div>
    </div>
  );

  const renderReviewSection = (
    section: DashboardSection,
    title: string,
    emptyMessage: string,
    loadMoreRef: RefObject<HTMLDivElement | null>,
    className = "col-xl-6",
  ) => {
    const page = dashboard[section];
    const loadingMore = loadingDashboardSections[section];

    return (
      <div className={className}>
        <div className="card h-100">
          <div className="card-header dashboard-section-header d-flex align-items-center gap-3">
            <h3 className="card-title flex-grow-1 mb-0">{title}</h3>
            <span className="badge text-bg-light border ms-auto flex-shrink-0">
              {page.total}
            </span>
          </div>
          <div className="card-body p-0">
            {page.items.length ? (
              <div className="list-group list-group-flush">
                {page.items.map(renderReview)}
              </div>
            ) : (
              <div className="empty-state">{emptyMessage}</div>
            )}
            {hasMoreReviews(section) || loadingMore ? (
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
  };

  const previewCommitLogMatches = preview ? commitLogMatches(preview) : [];

  return (
    <div className="row g-4">
      <div className="col-12">
        <div className="card card-primary card-outline">
          <div className="card-header">
            <h3 className="card-title">{t("pasteGitweb")}</h3>
          </div>
          <div className="card-body">
            <div className="row g-3 align-items-end">
              <div className="col-lg-9">
                <label className="form-label" htmlFor="gitweb-url">
                  {t("gitwebUrl")}
                </label>
                <div className="input-group">
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
                </div>
              </div>
              <div className="col-lg-3">
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
        <>
          <div className="modal d-block" role="dialog" aria-modal="true">
            <div className="modal-dialog modal-xl modal-dialog-scrollable">
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
                    onClick={closeCreateModal}
                  />
                </div>
                <div className="modal-body">
                  {preview.gitwebFetchError ? (
                    <div className="alert alert-warning">
                      {t("gitwebFetchError")}: {preview.gitwebFetchError}
                    </div>
                  ) : null}
                  <div className="row g-4">
                    <div className="col-lg-7">
                      <div className="mb-3">
                        <label className="form-label" htmlFor="modal-review-title">
                          {t("reviewTitle")}
                        </label>
                        <input
                          className="form-control"
                          id="modal-review-title"
                          value={createTitle}
                          readOnly
                        />
                      </div>
                      <div className="mb-3">
                        <label
                          className="form-label"
                          htmlFor="modal-review-description"
                        >
                          {t("description")}
                        </label>
                        <textarea
                          className="form-control"
                          id="modal-review-description"
                          readOnly
                          rows={8}
                          value={createDescription}
                        />
                      </div>
                    </div>
                    <div className="col-lg-5">
                      <div className="commit-summary-grid mb-3">
                        <div className="commit-summary-item commit-summary-project">
                          <span className="commit-summary-icon">
                            <i className="bi bi-box" aria-hidden="true" />
                          </span>
                          <span className="commit-summary-label">
                            {t("sourceProject")}
                          </span>
                          <span className="commit-summary-value text-break">
                            {preview.sourceProject || t("notAvailable")}
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
                              ? new Date(preview.gitwebFetchedAt).toLocaleString()
                              : t("notAvailable")}
                          </span>
                        </div>
                      </div>
                      {previewCommitLogMatches.length ? (
                        <div className="commit-log-match-panel mb-3">
                          <div className="commit-log-match-title">
                            <i className="bi bi-stars" aria-hidden="true" />
                            {t("commitLogMatches")}
                          </div>
                          <div className="commit-log-match-list">
                            {previewCommitLogMatches.map((match) => (
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
                          onChange={setCreateReviewerUserIds}
                        />
                      </div>
                    </div>
                  </div>
                  {preview.gitwebLog ? (
                    <details className="card mt-4 review-log-card">
                      <summary className="card-header fw-semibold">
                        {t("gitwebLog")}
                      </summary>
                      <pre className="card-body mb-0 review-log-body">
                        {preview.gitwebLog}
                      </pre>
                    </details>
                  ) : null}
                </div>
                <div className="modal-footer">
                  <button
                    className="btn btn-outline-secondary"
                    type="button"
                    onClick={closeCreateModal}
                  >
                    {t("cancel")}
                  </button>
                  <button
                    className="btn btn-primary d-inline-flex align-items-center gap-2"
                    type="button"
                    disabled={createLoading}
                    onClick={() => void createReview()}
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
      ) : null}
    </div>
  );
}
