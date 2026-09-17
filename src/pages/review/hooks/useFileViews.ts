import { useState } from "react";
import { apiRequest } from "../../../api/client";
import { useAuth } from "../../../auth/AuthProvider";
import { useI18n } from "../../../i18n/I18nProvider";
import { useToast } from "../../../layout/ToastProvider";
import type { ReviewCommit, ReviewItem } from "../../../types/api";
import { withId, withoutId } from "../../../utils/idList";
import { errorText } from "../review-display";
import type { ReviewData } from "./useReviewData";

export const fileViewKey = (commitId: string, filePath: string) =>
  `${commitId}:${filePath}`;

/** A commit with the current user's "viewed" mark on a file set or cleared. */
const withFileViewed = (
  commit: ReviewCommit,
  filePath: string,
  userId: string | undefined,
  viewed: boolean,
): ReviewCommit => ({
  ...commit,
  fileViews: viewed
    ? [
        ...commit.fileViews,
        {
          id: fileViewKey(commit.id, filePath),
          reviewCommitId: commit.id,
          userId: userId ?? "",
          filePath,
          createdAt: new Date().toISOString(),
        },
      ]
    : commit.fileViews.filter(
        (view) => !(view.userId === userId && view.filePath === filePath),
      ),
});

/** Which diff files are expanded, and which the current user viewed. */
export function useFileViews(data: ReviewData) {
  const { currentUser, idToken } = useAuth();
  const { t } = useI18n();
  const { showToast } = useToast();
  const { review, setReview } = data;
  const [expandedFileKeys, setExpandedFileKeys] = useState<
    Record<string, boolean>
  >({});
  const [savingFileViewKeys, setSavingFileViewKeys] = useState<string[]>([]);

  const isFileViewedByMe = (commit: ReviewCommit, filePath: string) =>
    commit.fileViews.some(
      (view) => view.userId === currentUser?.id && view.filePath === filePath,
    );

  const toggleFileViewed = async (commit: ReviewCommit, filePath: string) => {
    if (!idToken || !review) {
      return;
    }

    const key = fileViewKey(commit.id, filePath);
    const nextViewed = !isFileViewedByMe(commit, filePath);
    setSavingFileViewKeys((current) => withId(current, key));
    try {
      await apiRequest(
        `/reviews/${review.id}/commits/${commit.id}/files/viewed`,
        idToken,
        {
          method: "PUT",
          body: JSON.stringify({ filePath, viewed: nextViewed }),
        },
      );
      setReview((current: ReviewItem | null) =>
        current
          ? {
              ...current,
              commits: current.commits.map((currentCommit) =>
                currentCommit.id === commit.id
                  ? withFileViewed(
                      currentCommit,
                      filePath,
                      currentUser?.id,
                      nextViewed,
                    )
                  : currentCommit,
              ),
            }
          : current,
      );
      setExpandedFileKeys((current) => {
        const next = { ...current };
        delete next[key];
        return next;
      });
    } catch (error) {
      showToast(errorText(error, t));
    } finally {
      setSavingFileViewKeys((current) => withoutId(current, key));
    }
  };

  return {
    expandedFileKeys,
    setExpandedFileKeys,
    savingFileViewKeys,
    isFileViewedByMe,
    toggleFileViewed,
  };
}
