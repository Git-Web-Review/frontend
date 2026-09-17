import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { apiRequest } from "../../api/client";
import { useAuth } from "../../auth/AuthProvider";
import { useI18n } from "../../i18n/I18nProvider";
import { useToast } from "../../layout/ToastProvider";
import type {
  CommitLogLinkRule,
  ReviewField,
  ReviewItem,
  ReviewPreview,
} from "../../types/api";
import { toggleId } from "../../utils/idList";
import { errorText } from "../review/review-display";
import { dashboardLinkFromSearch } from "./dashboard-utils";

/**
 * The title a new review gets until the user types one: the branch of a
 * branch link, else the oldest selected commit.
 */
const defaultCreateTitle = (preview: ReviewPreview, selectedHashes: string[]) => {
  const branch = preview.sourceBranch?.trim();
  if (preview.linkKind === "SUMMARY" && branch && branch !== "master") {
    return branch;
  }

  const oldestSelected = [...preview.commitOptions]
    .reverse()
    .find((option) => selectedHashes.includes(option.hash));
  return oldestSelected?.title ?? preview.title ?? "";
};

/** Loads a list the create form needs, falling back to empty on failure. */
function useOptionalList<T>(path: string) {
  const { idToken } = useAuth();
  const [items, setItems] = useState<T[]>([]);

  useEffect(() => {
    const load = async () => {
      if (!idToken) {
        setItems([]);
        return;
      }

      try {
        setItems(await apiRequest<T[]>(path, idToken));
      } catch {
        setItems([]);
      }
    };
    void load();
  }, [idToken]);

  return items;
}

/**
 * Creating a review: preview the pasted git-web link, adjust what the modal
 * offers, then create. A `?link=` in the URL starts the preview on arrival.
 */
export function useCreateReview({
  onError,
  onCreated,
}: {
  onError: (message: string) => void;
  onCreated: () => Promise<void>;
}) {
  const { idToken } = useAuth();
  const { t } = useI18n();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const dashboardLink = dashboardLinkFromSearch(location.search);
  const processedLinkRef = useRef<string | null>(null);
  const [gitwebUrl, setGitwebUrl] = useState("");
  const [reviewerUserIds, setReviewerUserIds] = useState<string[]>([]);
  const [commitHashes, setCommitHashes] = useState<string[]>([]);
  const [title, setTitle] = useState("");
  const [titleTouched, setTitleTouched] = useState(false);
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({});
  const [preview, setPreview] = useState<ReviewPreview | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [createLoading, setCreateLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const commitLogLinkRules = useOptionalList<CommitLogLinkRule>(
    "/commit-log-link-rules",
  );
  const reviewFieldDefs = useOptionalList<ReviewField>("/review-fields");

  const previewReview = async (nextGitwebUrl = gitwebUrl) => {
    const normalizedGitwebUrl = nextGitwebUrl.trim();
    if (!idToken || !normalizedGitwebUrl) {
      return;
    }

    setGitwebUrl(normalizedGitwebUrl);
    onError("");
    setPreviewLoading(true);
    try {
      const nextPreview = await apiRequest<ReviewPreview>(
        "/reviews/preview",
        idToken,
        {
          method: "POST",
          body: JSON.stringify({ gitwebUrl: normalizedGitwebUrl }),
        },
      );
      setPreview(nextPreview);
      setReviewerUserIds([
        ...new Set(
          [
            ...nextPreview.defaultReviewerUsers,
            ...nextPreview.reviewerUsers,
          ].map((reviewer) => reviewer.id),
        ),
      ]);
      const selectedHashes = nextPreview.commitOptions.map(
        (option) => option.hash,
      );
      setCommitHashes(selectedHashes);
      setTitleTouched(false);
      setTitle(defaultCreateTitle(nextPreview, selectedHashes));
      setModalOpen(true);
    } catch (error) {
      onError(errorText(error, t));
    } finally {
      setPreviewLoading(false);
    }
  };

  useEffect(() => {
    if (
      !idToken ||
      !dashboardLink ||
      processedLinkRef.current === dashboardLink
    ) {
      return;
    }

    processedLinkRef.current = dashboardLink;
    void previewReview(dashboardLink);
  }, [idToken, dashboardLink]);

  const resetForm = () => {
    setGitwebUrl("");
    setReviewerUserIds([]);
    setCommitHashes([]);
    setTitle("");
    setFieldValues({});
    setPreview(null);
    setModalOpen(false);
  };

  const createReview = async () => {
    if (!idToken || !preview) {
      return;
    }

    onError("");
    setCreateLoading(true);
    try {
      const review = await apiRequest<ReviewItem>("/reviews", idToken, {
        method: "POST",
        body: JSON.stringify({
          gitwebUrl: preview.gitwebUrl,
          reviewerUserIds,
          ...(title.trim() ? { title: title.trim() } : {}),
          ...(preview.linkKind === "SUMMARY" ? { commitHashes } : {}),
          fieldValues: Object.entries(fieldValues)
            .map(([fieldId, value]) => ({ fieldId, value: value.trim() }))
            .filter((fieldValue) => fieldValue.value),
        }),
      });
      resetForm();
      showToast(t("reviewCreated"));
      await onCreated();
      navigate(`/review/${review.id}`);
    } catch (error) {
      onError(errorText(error, t));
    } finally {
      setCreateLoading(false);
    }
  };

  const toggleCommitHash = (hash: string) => {
    setCommitHashes((current) => {
      const nextSelection = toggleId(current, hash);
      if (preview && !titleTouched) {
        setTitle(defaultCreateTitle(preview, nextSelection));
      }
      return nextSelection;
    });
  };

  return {
    gitwebUrl,
    setGitwebUrl,
    previewLoading,
    previewReview,
    preview,
    modalOpen,
    closeModal: () => setModalOpen(false),
    title,
    changeTitle: (value: string) => {
      setTitleTouched(true);
      setTitle(value);
    },
    commitHashes,
    toggleCommitHash,
    reviewerUserIds,
    setReviewerUserIds,
    fieldValues,
    setFieldValue: (fieldId: string, value: string) =>
      setFieldValues((current) => ({ ...current, [fieldId]: value })),
    reviewFieldDefs,
    commitLogLinkRules,
    createLoading,
    createReview,
  };
}
