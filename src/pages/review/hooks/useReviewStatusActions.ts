import { useState } from "react";
import { apiRequest } from "../../../api/client";
import { useAuth } from "../../../auth/AuthProvider";
import { useI18n } from "../../../i18n/I18nProvider";
import type { TranslationKey } from "../../../i18n/translations";
import { useConfirm } from "../../../layout/ConfirmProvider";
import { useToast } from "../../../layout/ToastProvider";
import type {
  ReviewCommit,
  ReviewDeletion,
  ReviewItem,
} from "../../../types/api";
import { withId, withoutId } from "../../../utils/idList";
import type { ReviewPermissions } from "../review-permissions";
import type { ReviewData } from "./useReviewData";

type ReviewMethod = "PATCH" | "DELETE";

/** Acks, reviewed marks, closing and deleting the review. */
export function useReviewStatusActions(
  data: ReviewData,
  permissions: ReviewPermissions,
  onDeleted: (reviewId: string) => void,
) {
  const { idToken } = useAuth();
  const { t } = useI18n();
  const { showToast } = useToast();
  const confirm = useConfirm();
  const { review } = data;
  const [savingReviewAck, setSavingReviewAck] = useState(false);
  const [savingCommitAckIds, setSavingCommitAckIds] = useState<string[]>([]);
  const [savingCloseReview, setSavingCloseReview] = useState(false);
  const [deletingReview, setDeletingReview] = useState(false);

  /** Calls a review endpoint that answers with the updated review. */
  const updateReview = async (
    path: string,
    method: ReviewMethod,
    successKey: TranslationKey,
    setSaving: (saving: boolean) => void,
  ) => {
    if (!idToken || !review) {
      return;
    }

    setSaving(true);
    data.setErrorMessage("");
    try {
      const nextReview = await apiRequest<ReviewItem>(
        `/reviews/${review.id}${path}`,
        idToken,
        { method },
      );
      data.setReview(nextReview);
      showToast(t(successKey));
    } catch (error) {
      data.reportError(error);
    } finally {
      setSaving(false);
    }
  };

  const updateCommit = (
    commit: ReviewCommit,
    path: string,
    method: ReviewMethod,
    successKey: TranslationKey,
  ) =>
    updateReview(
      `/commits/${commit.id}${path}`,
      method,
      successKey,
      (saving) =>
        setSavingCommitAckIds((current) =>
          saving ? withId(current, commit.id) : withoutId(current, commit.id),
        ),
    );

  const acknowledgeReview = async () => {
    if (permissions.canAckReview) {
      await updateReview("/ack", "PATCH", "reviewAcknowledged", setSavingReviewAck);
    }
  };

  const unacknowledgeReview = () =>
    updateReview("/ack", "DELETE", "reviewAckWithdrawn", setSavingReviewAck);

  const markReviewReviewed = async () => {
    if (permissions.canMarkReviewReviewed) {
      await updateReview(
        "/reviewed",
        "PATCH",
        "reviewMarkedReviewed",
        setSavingReviewAck,
      );
    }
  };

  const acknowledgeCommit = async (commit: ReviewCommit) => {
    if (permissions.canAckCommit(commit)) {
      await updateCommit(commit, "/ack", "PATCH", "commitAcked");
    }
  };

  const unacknowledgeCommit = (commit: ReviewCommit) =>
    updateCommit(commit, "/ack", "DELETE", "commitAckWithdrawn");

  const markCommitReviewed = async (commit: ReviewCommit) => {
    if (permissions.canMarkCommitReviewed(commit)) {
      await updateCommit(commit, "/reviewed", "PATCH", "commitMarkedReviewed");
    }
  };

  const closeReview = async () => {
    if (permissions.canCloseReview) {
      await updateReview("/close", "PATCH", "reviewClosed", setSavingCloseReview);
    }
  };

  const deleteReview = async () => {
    if (!idToken || !review || !permissions.canDeleteReview) {
      return;
    }

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

    setDeletingReview(true);
    data.setErrorMessage("");
    try {
      await apiRequest<ReviewDeletion>(`/reviews/${review.id}`, idToken, {
        method: "DELETE",
      });
      showToast(t("reviewDeleted"));
      onDeleted(review.id);
    } catch (error) {
      data.reportError(error);
    } finally {
      setDeletingReview(false);
    }
  };

  return {
    savingReviewAck,
    savingCommitAckIds,
    savingCloseReview,
    deletingReview,
    acknowledgeReview,
    unacknowledgeReview,
    markReviewReviewed,
    acknowledgeCommit,
    unacknowledgeCommit,
    markCommitReviewed,
    closeReview,
    deleteReview,
  };
}
