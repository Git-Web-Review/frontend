import { useState } from "react";
import { apiRequest } from "../../../api/client";
import { useAuth } from "../../../auth/AuthProvider";
import { useI18n } from "../../../i18n/I18nProvider";
import { useToast } from "../../../layout/ToastProvider";
import type { ReviewItem, ReviewSyncPreview } from "../../../types/api";
import { toggleId } from "../../../utils/idList";
import { errorText } from "../review-display";

/** The modal that previews and applies a new version from the branch. */
export function useReviewSync(reviewId: string, onSynced: () => Promise<void>) {
  const { idToken } = useAuth();
  const { t } = useI18n();
  const { showToast } = useToast();
  const [syncModalOpen, setSyncModalOpen] = useState(false);
  const [syncPreview, setSyncPreview] = useState<ReviewSyncPreview | null>(
    null,
  );
  const [loadingSyncPreview, setLoadingSyncPreview] = useState(false);
  const [syncingReview, setSyncingReview] = useState(false);
  const [syncCommitHashes, setSyncCommitHashes] = useState<string[]>([]);

  const openSyncModal = async () => {
    if (!idToken) {
      return;
    }
    setSyncModalOpen(true);
    setSyncPreview(null);
    setLoadingSyncPreview(true);
    try {
      const preview = await apiRequest<ReviewSyncPreview>(
        `/reviews/${reviewId}/sync/preview`,
        idToken,
        { method: "POST" },
      );
      setSyncPreview(preview);
      setSyncCommitHashes(preview.commits.map((commit) => commit.hash));
    } catch (error) {
      showToast(errorText(error, t));
      setSyncModalOpen(false);
    } finally {
      setLoadingSyncPreview(false);
    }
  };

  const closeSyncModal = () => {
    setSyncModalOpen(false);
    setSyncPreview(null);
  };

  const toggleSyncCommit = (hash: string) => {
    setSyncCommitHashes((current) => toggleId(current, hash));
  };

  const applySync = async () => {
    if (!idToken || !syncPreview || syncCommitHashes.length === 0) {
      return;
    }

    setSyncingReview(true);
    try {
      await apiRequest<ReviewItem>(`/reviews/${reviewId}/sync`, idToken, {
        method: "POST",
        body: JSON.stringify({ commitHashes: syncCommitHashes }),
      });
      showToast(t("reviewSynced"));
      closeSyncModal();
      await onSynced();
    } catch (error) {
      showToast(errorText(error, t));
    } finally {
      setSyncingReview(false);
    }
  };

  return {
    syncModalOpen,
    syncPreview,
    loadingSyncPreview,
    syncingReview,
    syncCommitHashes,
    openSyncModal,
    closeSyncModal,
    toggleSyncCommit,
    applySync,
  };
}
