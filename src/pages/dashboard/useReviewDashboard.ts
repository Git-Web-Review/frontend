import { useEffect, useRef, useState } from "react";
import { apiRequest } from "../../api/client";
import { useAuth } from "../../auth/AuthProvider";
import { realtimeNotificationEvent } from "../../realtime/events";
import type { ReviewDashboard, ReviewDashboardPage } from "../../types/api";
import {
  DASHBOARD_PAGE_SIZE,
  emptyDashboardPage,
  projectSection,
  sectionProject,
  type DashboardSection,
  type PersonalSection,
} from "./dashboard-utils";

const dashboardQuery = (pages?: Partial<Record<PersonalSection, number>>) =>
  new URLSearchParams({
    ownedPage: String(pages?.owned ?? 1),
    assignedPage: String(pages?.assigned ?? 1),
    donePage: String(pages?.done ?? 1),
    limit: String(DASHBOARD_PAGE_SIZE),
  }).toString();

const pagesFromDashboard = (
  dashboard: ReviewDashboard,
): Partial<Record<DashboardSection, ReviewDashboardPage>> => ({
  owned: dashboard.owned,
  assigned: dashboard.assigned,
  done: dashboard.done,
  ...Object.fromEntries(
    dashboard.projects.map((page) => [projectSection(page.project), page]),
  ),
});

/**
 * The paginated review lists: the personal ones, then one per owned project.
 * The first page of each reloads on realtime events; the next pages load as
 * the end of the active list scrolls in.
 */
export function useReviewDashboard(activeSection: DashboardSection) {
  const { idToken } = useAuth();
  const [pages, setPages] = useState<
    Partial<Record<DashboardSection, ReviewDashboardPage>>
  >({});
  const [projects, setProjects] = useState<string[]>([]);
  const [loadingSections, setLoadingSections] = useState<
    Partial<Record<DashboardSection, boolean>>
  >({});
  // Only the active section is mounted, so one sentinel serves them all.
  const loadMoreRef = useRef<HTMLDivElement | null>(null);

  const loadDashboard = async () => {
    if (!idToken) {
      return;
    }

    const dashboard = await apiRequest<ReviewDashboard>(
      `/reviews/dashboard?${dashboardQuery()}`,
      idToken,
    );
    setPages(pagesFromDashboard(dashboard));
    setProjects(dashboard.projects.map((page) => page.project));
  };

  const pageOf = (section: DashboardSection) =>
    pages[section] ?? emptyDashboardPage();

  const hasMoreReviews = (section: DashboardSection) =>
    pageOf(section).page < pageOf(section).totalPages;

  const setSectionLoading = (section: DashboardSection, loading: boolean) =>
    setLoadingSections((current) => ({ ...current, [section]: loading }));

  const fetchPage = async (
    token: string,
    section: DashboardSection,
    page: number,
  ): Promise<ReviewDashboardPage> => {
    const project = sectionProject(section);
    if (project !== null) {
      return apiRequest<ReviewDashboardPage>(
        `/reviews/dashboard/projects/${encodeURIComponent(project)}?${new URLSearchParams(
          { page: String(page), limit: String(DASHBOARD_PAGE_SIZE) },
        )}`,
        token,
      );
    }

    const personalSection = section as PersonalSection;
    const dashboard = await apiRequest<ReviewDashboard>(
      `/reviews/dashboard?${dashboardQuery({ [personalSection]: page })}`,
      token,
    );
    return dashboard[personalSection];
  };

  const loadNextPage = async (section: DashboardSection) => {
    if (!idToken || loadingSections[section] || !hasMoreReviews(section)) {
      return;
    }

    setSectionLoading(section, true);
    try {
      const nextPage = await fetchPage(
        idToken,
        section,
        pageOf(section).page + 1,
      );
      setPages((current) => {
        const currentItems = current[section]?.items ?? [];
        const existingReviewIds = new Set(
          currentItems.map((review) => review.id),
        );
        return {
          ...current,
          [section]: {
            ...nextPage,
            items: [
              ...currentItems,
              ...nextPage.items.filter(
                (review) => !existingReviewIds.has(review.id),
              ),
            ],
          },
        };
      });
    } finally {
      setSectionLoading(section, false);
    }
  };

  useEffect(() => {
    void loadDashboard();
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
    if (
      !idToken ||
      typeof IntersectionObserver === "undefined" ||
      !loadMoreRef.current ||
      !hasMoreReviews(activeSection)
    ) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          void loadNextPage(activeSection);
        }
      },
      { rootMargin: "180px" },
    );
    observer.observe(loadMoreRef.current);

    return () => observer.disconnect();
  }, [idToken, pages, loadingSections, activeSection]);

  return {
    projects,
    pageOf,
    loadingSections,
    loadMoreRef,
    hasMoreReviews,
    loadDashboard,
  };
}
