import { type RefObject, useEffect, useRef, useState } from "react";
import { apiRequest } from "../../api/client";
import { useAuth } from "../../auth/AuthProvider";
import { realtimeNotificationEvent } from "../../realtime/events";
import type { ReviewDashboard } from "../../types/api";
import {
  DASHBOARD_PAGE_SIZE,
  emptyDashboardPage,
  type DashboardSection,
} from "./dashboard-utils";

const dashboardQuery = (pages?: Partial<Record<DashboardSection, number>>) =>
  new URLSearchParams({
    ownedPage: String(pages?.owned ?? 1),
    assignedPage: String(pages?.assigned ?? 1),
    donePage: String(pages?.done ?? 1),
    limit: String(DASHBOARD_PAGE_SIZE),
  }).toString();

/**
 * The three paginated review lists. The first page of each reloads on
 * realtime events; the next pages load as the end of the list scrolls in.
 */
export function useReviewDashboard(activeSection: DashboardSection) {
  const { idToken } = useAuth();
  const [dashboard, setDashboard] = useState<ReviewDashboard>({
    owned: emptyDashboardPage(),
    assigned: emptyDashboardPage(),
    done: emptyDashboardPage(),
  });
  const [loadingSections, setLoadingSections] = useState<
    Record<DashboardSection, boolean>
  >({
    owned: false,
    assigned: false,
    done: false,
  });
  const ownedLoadMoreRef = useRef<HTMLDivElement | null>(null);
  const assignedLoadMoreRef = useRef<HTMLDivElement | null>(null);
  const doneLoadMoreRef = useRef<HTMLDivElement | null>(null);
  const loadMoreRefs: Record<
    DashboardSection,
    RefObject<HTMLDivElement | null>
  > = {
    owned: ownedLoadMoreRef,
    assigned: assignedLoadMoreRef,
    done: doneLoadMoreRef,
  };

  const loadDashboard = async () => {
    if (!idToken) {
      return;
    }

    setDashboard(
      await apiRequest<ReviewDashboard>(
        `/reviews/dashboard?${dashboardQuery()}`,
        idToken,
      ),
    );
  };

  const hasMoreReviews = (section: DashboardSection) =>
    dashboard[section].page < dashboard[section].totalPages;

  const setSectionLoading = (section: DashboardSection, loading: boolean) =>
    setLoadingSections((current) => ({ ...current, [section]: loading }));

  const loadNextPage = async (section: DashboardSection) => {
    if (!idToken || loadingSections[section] || !hasMoreReviews(section)) {
      return;
    }

    setSectionLoading(section, true);
    try {
      const nextDashboard = await apiRequest<ReviewDashboard>(
        `/reviews/dashboard?${dashboardQuery({
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
            void loadNextPage(section);
          }
        }
      },
      { rootMargin: "180px" },
    );

    for (const [section, ref] of Object.entries(loadMoreRefs) as Array<
      [DashboardSection, RefObject<HTMLDivElement | null>]
    >) {
      if (ref.current && hasMoreReviews(section)) {
        observer.observe(ref.current);
      }
    }

    return () => observer.disconnect();
  }, [idToken, dashboard, loadingSections, activeSection]);

  return {
    dashboard,
    loadingSections,
    loadMoreRefs,
    hasMoreReviews,
    loadDashboard,
  };
}
