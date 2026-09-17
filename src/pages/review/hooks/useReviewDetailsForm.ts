import { useEffect, useState } from "react";
import { apiRequest } from "../../../api/client";
import { useAuth } from "../../../auth/AuthProvider";
import { useI18n } from "../../../i18n/I18nProvider";
import { useToast } from "../../../layout/ToastProvider";
import type { ReviewItem } from "../../../types/api";
import { withId, withoutId } from "../../../utils/idList";
import { errorText } from "../review-display";
import type { ReviewPermissions } from "../review-permissions";
import type { ReviewData } from "./useReviewData";

const sortedIds = (userIds: string[]) => [...userIds].sort().join("\n");

/** Drafts of the title, description and reviewers, reset on each load. */
export function useReviewDetailsDrafts() {
  const [reviewerUserIds, setReviewerUserIds] = useState<string[]>([]);
  const [titleDraft, setTitleDraft] = useState("");
  const [descriptionDraft, setDescriptionDraft] = useState("");

  const resetDrafts = (review: ReviewItem) => {
    setReviewerUserIds(review.reviewers.map((reviewer) => reviewer.userId));
    setTitleDraft(review.title ?? "");
    setDescriptionDraft(review.description ?? "");
  };

  return {
    reviewerUserIds,
    setReviewerUserIds,
    titleDraft,
    setTitleDraft,
    descriptionDraft,
    setDescriptionDraft,
    resetDrafts,
  };
}

export type ReviewDetailsDrafts = ReturnType<typeof useReviewDetailsDrafts>;

/** Saving the review details and the values of its custom fields. */
export function useReviewDetailsForm(
  data: ReviewData,
  drafts: ReviewDetailsDrafts,
  permissions: ReviewPermissions,
) {
  const { idToken } = useAuth();
  const { t } = useI18n();
  const { showToast } = useToast();
  const { review, setReview } = data;
  const { canEditReviewDetails, canAddReviewers } = permissions;
  const [savingReview, setSavingReview] = useState(false);
  const [fieldValueDrafts, setFieldValueDrafts] = useState<
    Record<string, string>
  >({});
  const [savingFieldIds, setSavingFieldIds] = useState<string[]>([]);

  useEffect(() => {
    if (!review) {
      return;
    }

    setFieldValueDrafts(
      Object.fromEntries(
        review.fieldValues.map((fieldValue) => [
          fieldValue.fieldId,
          fieldValue.value,
        ]),
      ),
    );
  }, [review]);

  const addedReviewerUserIds = drafts.reviewerUserIds.filter(
    (userId) =>
      !review?.reviewers.some((reviewer) => reviewer.userId === userId),
  );
  const titleChanged =
    !!review && drafts.titleDraft.trim() !== (review.title ?? "").trim();
  const hasReviewChanges =
    !!review &&
    (canEditReviewDetails
      ? sortedIds(drafts.reviewerUserIds) !==
          sortedIds(review.reviewers.map((reviewer) => reviewer.userId)) ||
        titleChanged ||
        drafts.descriptionDraft.trim() !== (review.description ?? "").trim()
      : canAddReviewers && addedReviewerUserIds.length > 0);

  const saveReview = async () => {
    if (!idToken || !review || !hasReviewChanges) {
      return;
    }

    setSavingReview(true);
    data.setErrorMessage("");
    try {
      const nextReview = canEditReviewDetails
        ? await apiRequest<ReviewItem>(`/reviews/${review.id}`, idToken, {
            method: "PATCH",
            body: JSON.stringify({
              reviewerUserIds: drafts.reviewerUserIds,
              ...(titleChanged ? { title: drafts.titleDraft.trim() } : {}),
              description: drafts.descriptionDraft.trim() || null,
            }),
          })
        : await apiRequest<ReviewItem>(
            `/reviews/${review.id}/reviewers`,
            idToken,
            {
              method: "POST",
              body: JSON.stringify({ userIds: addedReviewerUserIds }),
            },
          );
      setReview(nextReview);
      showToast(t(canEditReviewDetails ? "reviewSaved" : "reviewersAdded"));
    } catch (error) {
      data.reportError(error);
    } finally {
      setSavingReview(false);
    }
  };

  const savedFieldValue = (fieldId: string) =>
    review?.fieldValues.find((fieldValue) => fieldValue.fieldId === fieldId)
      ?.value ?? "";

  const setFieldValueDraft = (fieldId: string, value: string) =>
    setFieldValueDrafts((current) => ({ ...current, [fieldId]: value }));

  const saveFieldValue = async (fieldId: string) => {
    if (!idToken || !review) {
      return;
    }

    const draft = (fieldValueDrafts[fieldId] ?? "").trim();
    setSavingFieldIds((current) => withId(current, fieldId));
    try {
      const nextReview = await apiRequest<ReviewItem>(
        `/reviews/${data.reviewId}/fields/${fieldId}`,
        idToken,
        {
          method: "PUT",
          body: JSON.stringify({ value: draft || null }),
        },
      );
      setReview(nextReview);
      showToast(t("reviewFieldValueSaved"));
    } catch (error) {
      showToast(errorText(error, t));
    } finally {
      setSavingFieldIds((current) => withoutId(current, fieldId));
    }
  };

  return {
    savingReview,
    hasReviewChanges,
    saveReview,
    fieldValueDrafts,
    setFieldValueDraft,
    savingFieldIds,
    savedFieldValue,
    saveFieldValue,
  };
}
