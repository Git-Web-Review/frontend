import { useEffect, useMemo, useRef, useState } from "react";
import { apiRequest } from "../api/client";
import { useI18n } from "../i18n/I18nProvider";
import type { ReviewerCandidatePage, ReviewUserSummary } from "../types/api";

type ReviewerSearchSelectProps = {
  idToken: string | null;
  label?: string;
  selectedUserIds: string[];
  selectedUsers: ReviewUserSummary[];
  excludeUserIds?: string[];
  disabled?: boolean;
  onChange: (userIds: string[]) => void;
};

const reviewerSearchLimit = 10;

export function ReviewerSearchSelect({
  idToken,
  label,
  selectedUserIds,
  selectedUsers,
  excludeUserIds = [],
  disabled = false,
  onChange,
}: ReviewerSearchSelectProps) {
  const { t } = useI18n();
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ReviewUserSummary[]>([]);
  const [selectedResultUsers, setSelectedResultUsers] = useState<
    ReviewUserSummary[]
  >([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const excludedIds = useMemo(() => new Set(excludeUserIds), [excludeUserIds]);
  const selectedIds = useMemo(
    () => new Set(selectedUserIds),
    [selectedUserIds],
  );
  const knownSelectedUsers = useMemo(() => {
    const usersById = new Map<string, ReviewUserSummary>();
    for (const user of selectedUsers) {
      usersById.set(user.id, user);
    }
    for (const user of selectedResultUsers) {
      usersById.set(user.id, user);
    }

    return selectedUserIds
      .map((userId) => usersById.get(userId))
      .filter((user): user is ReviewUserSummary => !!user);
  }, [selectedResultUsers, selectedUserIds, selectedUsers]);

  const renderUserLabel = (user: ReviewUserSummary) =>
    user.nickname || user.hostname || user.email;

  const searchReviewers = async (nextPage: number, append = false) => {
    const search = query.trim();
    if (!idToken || !search) {
      setResults([]);
      setPage(1);
      setTotalPages(0);
      return;
    }

    setLoading(true);
    setErrorMessage("");
    try {
      const params = new URLSearchParams({
        q: search,
        page: nextPage.toString(),
        limit: reviewerSearchLimit.toString(),
      });
      for (const userId of excludedIds) {
        params.append("excludeUserIds", userId);
      }
      const response = await apiRequest<ReviewerCandidatePage>(
        `/v1/me/reviewer-candidates?${params.toString()}`,
        idToken,
      );
      setResults((current) =>
        append ? [...current, ...response.items] : response.items,
      );
      setPage(response.page);
      setTotalPages(response.totalPages);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : t("backendError"),
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const search = query.trim();
    if (!search) {
      setResults([]);
      setPage(1);
      setTotalPages(0);
      setErrorMessage("");
      return;
    }

    const timeoutId = window.setTimeout(() => {
      void searchReviewers(1);
    }, 250);

    return () => window.clearTimeout(timeoutId);
  }, [idToken, query]);

  const addReviewer = (user: ReviewUserSummary) => {
    if (selectedIds.has(user.id) || excludedIds.has(user.id)) {
      return;
    }

    setSelectedResultUsers((current) =>
      current.some((knownUser) => knownUser.id === user.id)
        ? current
        : [...current, user],
    );
    onChange([...selectedUserIds, user.id]);
    setQuery("");
    setResults([]);
    setOpen(false);
  };

  const removeReviewer = (userId: string) => {
    onChange(selectedUserIds.filter((selectedId) => selectedId !== userId));
  };

  const openSearch = () => {
    if (disabled) {
      return;
    }

    setOpen(true);
    window.setTimeout(() => searchInputRef.current?.focus(), 0);
  };

  const visibleResults = results.filter(
    (user) => !selectedIds.has(user.id) && !excludedIds.has(user.id),
  );
  const canLoadMore = page < totalPages;

  return (
    <div className="reviewer-search-select">
      {label ? (
        <div className="d-flex align-items-center justify-content-between gap-2 mb-2">
          <span className="form-label mb-0">{label}</span>
          {!disabled ? (
            <button
              className="btn btn-success btn-sm d-inline-flex align-items-center justify-content-center reviewer-add-button"
              title={t("searchReviewers")}
              type="button"
              onClick={openSearch}
            >
              <i className="bi bi-plus-lg" aria-hidden="true" />
            </button>
          ) : null}
        </div>
      ) : null}
      {knownSelectedUsers.length ? (
        <div className="reviewer-selected-list mb-2">
          {knownSelectedUsers.map((user) => (
            <span className="reviewer-selected-chip" key={user.id}>
              <span>
                <span className="fw-semibold">{renderUserLabel(user)}</span>
                <span className="reviewer-selected-email">{user.email}</span>
              </span>
              <button
                className="btn btn-sm btn-link p-0 reviewer-selected-remove"
                disabled={disabled}
                type="button"
                onClick={() => removeReviewer(user.id)}
              >
                <i className="bi bi-x-lg" aria-hidden="true" />
                <span className="visually-hidden">{t("removeReviewer")}</span>
              </button>
            </span>
          ))}
        </div>
      ) : null}
      <div className="position-relative">
        {!label ? (
          <input
            ref={searchInputRef}
            className="form-control"
            disabled={disabled}
            placeholder={t("searchReviewers")}
            type="search"
            value={query}
            onBlur={() => window.setTimeout(() => setOpen(false), 150)}
            onChange={(event) => {
              setQuery(event.target.value);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
          />
        ) : null}
        {open ? (
          <div className="dropdown-menu reviewer-search-menu show">
            {label ? (
              <div className="px-2 pb-2">
                <input
                  ref={searchInputRef}
                  className="form-control form-control-sm"
                  disabled={disabled}
                  placeholder={t("searchReviewers")}
                  type="search"
                  value={query}
                  onBlur={() => window.setTimeout(() => setOpen(false), 150)}
                  onChange={(event) => {
                    setQuery(event.target.value);
                    setOpen(true);
                  }}
                />
              </div>
            ) : null}
            {errorMessage ? (
              <div className="dropdown-item-text text-danger small">
                {errorMessage}
              </div>
            ) : null}
            {query.trim()
              ? visibleResults.map((user) => (
              <button
                className="dropdown-item reviewer-search-option"
                key={user.id}
                type="button"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => addReviewer(user)}
              >
                <span className="fw-semibold">{renderUserLabel(user)}</span>
                <span className="d-block small text-secondary">{user.email}</span>
              </button>
                ))
              : null}
            {query.trim() && !loading && !visibleResults.length && !errorMessage ? (
              <div className="dropdown-item-text text-secondary small">
                {t("noReviewerSearchResults")}
              </div>
            ) : null}
            {loading ? (
              <div className="dropdown-item-text text-secondary small">
                <span className="spinner-border spinner-border-sm me-2" />
                {t("loadingReviewers")}
              </div>
            ) : null}
            {canLoadMore ? (
              <button
                className="dropdown-item text-primary"
                disabled={loading}
                type="button"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => void searchReviewers(page + 1, true)}
              >
                {t("loadMoreReviewers")}
              </button>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}