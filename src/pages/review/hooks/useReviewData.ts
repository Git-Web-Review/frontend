import { useEffect, useState } from "react";
import { apiRequest } from "../../../api/client";
import { useAuth } from "../../../auth/AuthProvider";
import { useI18n } from "../../../i18n/I18nProvider";
import {
  realtimeNotificationEvent,
  type RealtimeNotificationEvent,
} from "../../../realtime/events";
import type {
  CommitLogLinkRule,
  ReviewComment,
  ReviewField,
  ReviewItem,
} from "../../../types/api";
import { errorText } from "../review-display";
import { notificationMatchesReview } from "../review-utils";

/**
 * The review, its comments and the settings it is displayed with, reloaded
 * when a realtime notification concerns it.
 */
export function useReviewData(
  reviewId: string,
  onReviewLoaded: (review: ReviewItem) => void,
) {
  const { idToken } = useAuth();
  const { t } = useI18n();
  const [review, setReview] = useState<ReviewItem | null>(null);
  const [commitLogLinkRules, setCommitLogLinkRules] = useState<
    CommitLogLinkRule[]
  >([]);
  const [reviewFieldDefs, setReviewFieldDefs] = useState<ReviewField[]>([]);
  const [reviewComments, setReviewComments] = useState<ReviewComment[]>([]);
  const [loadingReview, setLoadingReview] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const reportError = (error: unknown) => setErrorMessage(errorText(error, t));

  const loadReview = async () => {
    if (!idToken) {
      return;
    }

    setLoadingReview(true);
    setErrorMessage("");
    try {
      const nextReview = await apiRequest<ReviewItem>(
        `/reviews/${reviewId}`,
        idToken,
      );
      setReview(nextReview);
      onReviewLoaded(nextReview);
    } catch (error) {
      reportError(error);
    } finally {
      setLoadingReview(false);
    }
  };

  const refreshReviewSnapshot = async () => {
    if (!idToken) {
      return;
    }

    setReview(await apiRequest<ReviewItem>(`/reviews/${reviewId}`, idToken));
  };

  const loadCommitLogLinkRules = async () => {
    if (!idToken) {
      return;
    }

    setCommitLogLinkRules(
      await apiRequest<CommitLogLinkRule[]>("/commit-log-link-rules", idToken),
    );
  };

  const loadReviewFieldDefs = async () => {
    if (!idToken) {
      return;
    }

    setReviewFieldDefs(
      await apiRequest<ReviewField[]>("/review-fields", idToken),
    );
  };

  const loadReviewComments = async () => {
    if (!idToken) {
      setReviewComments([]);
      return;
    }

    setReviewComments(
      await apiRequest<ReviewComment[]>(
        `/reviews/${reviewId}/comments`,
        idToken,
      ),
    );
  };

  useEffect(() => {
    void loadReview();
    void loadCommitLogLinkRules();
    void loadReviewFieldDefs();
    void loadReviewComments();
  }, [idToken, reviewId]);

  useEffect(() => {
    if (!idToken || !review) {
      return;
    }

    const refreshCurrentReview = (event: Event) => {
      const realtimeEvent = event as CustomEvent<RealtimeNotificationEvent>;
      if (!notificationMatchesReview(realtimeEvent.detail, review)) {
        return;
      }

      void loadReview();
      void loadReviewComments();
    };

    window.addEventListener(realtimeNotificationEvent, refreshCurrentReview);
    return () => {
      window.removeEventListener(
        realtimeNotificationEvent,
        refreshCurrentReview,
      );
    };
  }, [idToken, review]);

  return {
    reviewId,
    review,
    setReview,
    commitLogLinkRules,
    reviewFieldDefs,
    reviewComments,
    setReviewComments,
    loadingReview,
    errorMessage,
    setErrorMessage,
    reportError,
    loadReview,
    loadReviewComments,
    refreshReviewSnapshot,
  };
}

export type ReviewData = ReturnType<typeof useReviewData>;
