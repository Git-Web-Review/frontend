import { type ReactNode, useEffect, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { apiRequest } from "../../api/client";
import { useAuth } from "../../auth/AuthProvider";
import { ReviewerSearchSelect } from "../../components/ReviewerSearchSelect";
import { DateTimeText } from "../../components/DateTimeText";
import { useI18n } from "../../i18n/I18nProvider";
import { useToast } from "../../layout/ToastProvider";
import {
  realtimeNotificationEvent,
  type RealtimeNotificationEvent,
} from "../../realtime/events";
import type {
  CommitLogLinkRule,
  ReviewComment,
  ReviewCommentSide,
  ReviewCommit,
  ReviewDeletion,
  ReviewField,
  ReviewItem,
  ReviewStatus,
  ReviewSyncPreview,
  ReviewUserSummary,
} from "../../types/api";
import {
  reviewStatusBadgeClass,
} from "../../utils/reviewStatus";
import { projectName } from "../../utils/projectName";
import { gitwebFetchErrorLabel } from "../../utils/gitwebFetchError";
import { InlineCommentComposer } from "./InlineCommentComposer";
import { FilesTabPanel } from "./FilesTabPanel";
import { CommentsTabPanel } from "./CommentsTabPanel";
import { OverviewTabPanel } from "./OverviewTabPanel";
import { linkedCommitLog } from "./gitweb-links";
import { ReviewHeader } from "./ReviewHeader";
import { MarkdownView } from "./MarkdownView";
import {
  CommentDoneMeta,
  CommentMessages,
  CommentReplyForm,
  CommentThreadControls,
  type CommentMessageActions,
} from "./CommentThreadParts";
import {
  notificationMatchesReview,
  type CommentTarget,
  type ReviewCommentThread,
  type ReviewTab,
} from "./review-utils";
import { SyncModal } from "./SyncModal";

export function ReviewPage() {
  const { reviewId = "" } = useParams<{ reviewId: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { currentUser, idToken } = useAuth();
  const { t } = useI18n();
  const { showToast } = useToast();
  const [review, setReview] = useState<ReviewItem | null>(null);
  const [commitLogLinkRules, setCommitLogLinkRules] = useState<
    CommitLogLinkRule[]
  >([]);
  const [reviewerUserIds, setReviewerUserIds] = useState<string[]>([]);
  const [reviewTitleDraft, setReviewTitleDraft] = useState("");
  const [reviewDescriptionDraft, setReviewDescriptionDraft] = useState("");
  const activeReviewTab = (
    searchParams.get("tab") === "files" ||
    searchParams.get("tab") === "comments"
      ? searchParams.get("tab")
      : "overview"
  ) as ReviewTab;
  const [loadingReview, setLoadingReview] = useState(false);
  const [savingReview, setSavingReview] = useState(false);
  const [savingCloseReview, setSavingCloseReview] = useState(false);
  const [deletingReview, setDeletingReview] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [inlineCommentTarget, setInlineCommentTarget] =
    useState<CommentTarget | null>(null);
  const [savingComment, setSavingComment] = useState(false);
  const [reviewComments, setReviewComments] = useState<ReviewComment[]>([]);
  const [loadingReviewComments, setLoadingReviewComments] = useState(false);
  const [savingDoneCommentIds, setSavingDoneCommentIds] = useState<string[]>([]);
  const [deletingCommentIds, setDeletingCommentIds] = useState<string[]>([]);
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editCommentDraft, setEditCommentDraft] = useState("");
  const [savingEditCommentIds, setSavingEditCommentIds] = useState<string[]>(
    [],
  );
  const [expandedCommentIds, setExpandedCommentIds] = useState<string[]>([]);
  const [collapsedCommentIds, setCollapsedCommentIds] = useState<string[]>([]);
  const [expandedDiscussionIds, setExpandedDiscussionIds] = useState<string[]>(
    [],
  );
  const [pendingDiffAnchor, setPendingDiffAnchor] = useState<string | null>(
    null,
  );
  const handledDiffLocationRef = useRef<string | null>(null);
  const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({});
  const [savingReplyCommentIds, setSavingReplyCommentIds] = useState<string[]>(
    [],
  );
  const [savingReviewAck, setSavingReviewAck] = useState(false);
  const [savingCommitAckIds, setSavingCommitAckIds] = useState<string[]>([]);
  const [reviewActionMenuOpen, setReviewActionMenuOpen] = useState(false);
  const [commitActionMenuOpenId, setCommitActionMenuOpenId] = useState<
    string | null
  >(null);
  const [activeCommitId, setActiveCommitId] = useState<string | null>(null);
  const [commitNavOpen, setCommitNavOpen] = useState(false);
  const [descriptionExpanded, setDescriptionExpanded] = useState(false);
  const [reviewFieldDefs, setReviewFieldDefs] = useState<ReviewField[]>([]);
  const [fieldValueDrafts, setFieldValueDrafts] = useState<
    Record<string, string>
  >({});
  const [savingFieldIds, setSavingFieldIds] = useState<string[]>([]);
  const [expandedFileKeys, setExpandedFileKeys] = useState<
    Record<string, boolean>
  >({});
  const [savingFileViewKeys, setSavingFileViewKeys] = useState<string[]>([]);
  const [syncModalOpen, setSyncModalOpen] = useState(false);
  const [syncPreview, setSyncPreview] = useState<ReviewSyncPreview | null>(
    null,
  );
  const [loadingSyncPreview, setLoadingSyncPreview] = useState(false);
  const [syncingReview, setSyncingReview] = useState(false);
  const [syncCommitHashes, setSyncCommitHashes] = useState<string[]>([]);

  const loadReview = async () => {
    if (!idToken) {
      return;
    }

    setLoadingReview(true);
    setErrorMessage("");
    try {
      const nextReview = await apiRequest<ReviewItem>(
        `/v1/reviews/${reviewId}`,
        idToken,
      );
      setReview(nextReview);
      setReviewerUserIds(
        nextReview.reviewers.map((reviewer) => reviewer.userId),
      );
      setReviewTitleDraft(nextReview.title ?? "");
      setReviewDescriptionDraft(nextReview.description ?? "");
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : t("backendError"),
      );
    } finally {
      setLoadingReview(false);
    }
  };

  const refreshReviewSnapshot = async () => {
    if (!idToken) {
      return;
    }

    setReview(
      await apiRequest<ReviewItem>(`/v1/reviews/${reviewId}`, idToken),
    );
  };

  const loadCommitLogLinkRules = async () => {
    if (!idToken) {
      return;
    }

    setCommitLogLinkRules(
      await apiRequest<CommitLogLinkRule[]>(
        "/v1/commit-log-link-rules",
        idToken,
      ),
    );
  };

  const loadReviewFieldDefs = async () => {
    if (!idToken) {
      return;
    }

    setReviewFieldDefs(
      await apiRequest<ReviewField[]>("/v1/review-fields", idToken),
    );
  };

  const loadReviewComments = async () => {
    if (!idToken) {
      setReviewComments([]);
      return;
    }

    setLoadingReviewComments(true);
    try {
      setReviewComments(
        await apiRequest<ReviewComment[]>(
          `/v1/reviews/${reviewId}/comments`,
          idToken,
        ),
      );
    } finally {
      setLoadingReviewComments(false);
    }
  };

  const savedFieldValue = (fieldId: string) =>
    review?.fieldValues.find((fieldValue) => fieldValue.fieldId === fieldId)
      ?.value ?? "";

  const fieldPlaceholder = (type: ReviewField["type"]) => {
    switch (type) {
      case "LINK":
        return t("fieldPlaceholderLink");
      case "IMAGE":
        return t("fieldPlaceholderImage");
      case "NUMBER":
        return t("fieldPlaceholderNumber");
      default:
        return t("fieldPlaceholderText");
    }
  };

  const saveFieldValue = async (fieldId: string) => {
    if (!idToken || !review) {
      return;
    }

    const draft = (fieldValueDrafts[fieldId] ?? "").trim();
    setSavingFieldIds((current) => [...current, fieldId]);
    try {
      const nextReview = await apiRequest<ReviewItem>(
        `/v1/reviews/${reviewId}/fields/${fieldId}`,
        idToken,
        {
          method: "PUT",
          body: JSON.stringify({ value: draft || null }),
        },
      );
      setReview(nextReview);
      showToast(t("reviewFieldValueSaved"));
    } catch (error) {
      showToast(error instanceof Error ? error.message : t("backendError"));
    } finally {
      setSavingFieldIds((current) => current.filter((id) => id !== fieldId));
    }
  };

  const openSyncModal = async () => {
    if (!idToken) {
      return;
    }
    setSyncModalOpen(true);
    setSyncPreview(null);
    setLoadingSyncPreview(true);
    try {
      const preview = await apiRequest<ReviewSyncPreview>(
        `/v1/reviews/${reviewId}/sync/preview`,
        idToken,
        { method: "POST" },
      );
      setSyncPreview(preview);
      setSyncCommitHashes(preview.commits.map((commit) => commit.hash));
    } catch (error) {
      showToast(error instanceof Error ? error.message : t("backendError"));
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
    setSyncCommitHashes((current) =>
      current.includes(hash)
        ? current.filter((currentHash) => currentHash !== hash)
        : [...current, hash],
    );
  };

  const applySync = async () => {
    if (!idToken || !syncPreview || syncCommitHashes.length === 0) {
      return;
    }

    setSyncingReview(true);
    try {
      await apiRequest<ReviewItem>(`/v1/reviews/${reviewId}/sync`, idToken, {
        method: "POST",
        body: JSON.stringify({ commitHashes: syncCommitHashes }),
      });
      showToast(t("reviewSynced"));
      closeSyncModal();
      await loadReview();
      await loadReviewComments();
    } catch (error) {
      showToast(error instanceof Error ? error.message : t("backendError"));
    } finally {
      setSyncingReview(false);
    }
  };

  const fileViewKey = (commitId: string, filePath: string) =>
    `${commitId}:${filePath}`;

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
    setSavingFileViewKeys((current) => [...current, key]);
    try {
      await apiRequest(
        `/v1/reviews/${review.id}/commits/${commit.id}/files/viewed`,
        idToken,
        {
          method: "PUT",
          body: JSON.stringify({ filePath, viewed: nextViewed }),
        },
      );
      setReview((current) =>
        current
          ? {
              ...current,
              commits: current.commits.map((currentCommit) =>
                currentCommit.id === commit.id
                  ? {
                      ...currentCommit,
                      fileViews: nextViewed
                        ? [
                            ...currentCommit.fileViews,
                            {
                              id: key,
                              reviewCommitId: commit.id,
                              userId: currentUser?.id ?? "",
                              filePath,
                              createdAt: new Date().toISOString(),
                            },
                          ]
                        : currentCommit.fileViews.filter(
                            (view) =>
                              !(
                                view.userId === currentUser?.id &&
                                view.filePath === filePath
                              ),
                          ),
                    }
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
      showToast(error instanceof Error ? error.message : t("backendError"));
    } finally {
      setSavingFileViewKeys((current) =>
        current.filter((currentKey) => currentKey !== key),
      );
    }
  };

  useEffect(() => {
    void loadReview();
    void loadCommitLogLinkRules();
    void loadReviewFieldDefs();
    void loadReviewComments();
  }, [idToken, reviewId]);

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

  useEffect(() => {
    if (!review) {
      return;
    }

    setActiveCommitId((current) => {
      if (current && review.commits.some((commit) => commit.id === current)) {
        return current;
      }
      const firstOpenCommit = review.commits.find(
        (commit) => commit.status !== "ACKED",
      );
      return (firstOpenCommit ?? review.commits[0])?.id ?? null;
    });
  }, [review]);

  useEffect(() => {
    if (!pendingDiffAnchor || activeReviewTab !== "files") {
      return;
    }

    const frame = requestAnimationFrame(() => {
      const element = document.getElementById(pendingDiffAnchor);
      if (!element) {
        return;
      }

      element.scrollIntoView({ behavior: "smooth", block: "center" });
      element.classList.add("diff-anchor-highlight");
      window.setTimeout(() => {
        element.classList.remove("diff-anchor-highlight");
      }, 2000);
      setPendingDiffAnchor(null);
    });

    return () => cancelAnimationFrame(frame);
  }, [pendingDiffAnchor, activeReviewTab, activeCommitId]);

  useEffect(() => {
    if (!review || activeReviewTab !== "files") {
      return;
    }

    const commitParam = searchParams.get("commit");
    if (!commitParam) {
      return;
    }

    const fileParam = searchParams.get("file");
    const lineParam = searchParams.get("line");
    const sideParam: ReviewCommentSide =
      searchParams.get("side") === "BEFORE" ? "BEFORE" : "AFTER";
    const signature = `${commitParam}:${fileParam ?? ""}:${lineParam ?? ""}:${sideParam}`;
    if (handledDiffLocationRef.current === signature) {
      return;
    }

    const commit = review.commits.find(
      (currentCommit) =>
        currentCommit.hash === commitParam ||
        currentCommit.hash.startsWith(commitParam),
    );
    if (!commit) {
      return;
    }

    handledDiffLocationRef.current = signature;
    setActiveCommitId(commit.id);
    if (fileParam) {
      setExpandedFileKeys((current) => ({
        ...current,
        [`${commit.id}:${fileParam}`]: true,
      }));
    }
    const parsedLine = lineParam ? Number(lineParam) : Number.NaN;
    setPendingDiffAnchor(
      diffAnchorId({
        commitHash: commit.hash,
        filePath: fileParam,
        lineNumber: Number.isInteger(parsedLine) ? parsedLine : null,
        side: sideParam,
      }),
    );
  }, [review, searchParams, activeReviewTab]);

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
      window.removeEventListener(realtimeNotificationEvent, refreshCurrentReview);
    };
  }, [idToken, review]);

  const setActiveReviewTab = (tab: ReviewTab) => {
    setSearchParams(tab === "overview" ? {} : { tab });
  };

  const sortedReviewerUserIds = (userIds: string[]) => [...userIds].sort();

  const canDeleteReview = !!review && review.ownerId === currentUser?.id;
  const canEditReviewDetails = !!review && review.ownerId === currentUser?.id;
  const canUpdateCommentDone =
    !!review &&
    (review.ownerId === currentUser?.id ||
      review.reviewers.some((reviewer) => reviewer.userId === currentUser?.id));
  const currentReviewer = review?.reviewers.find(
    (reviewer) => reviewer.userId === currentUser?.id,
  );
  const commitAckedByMe = (commit: ReviewCommit) =>
    commit.acks.some((ack) => ack.userId === currentUser?.id);
  const openCommentCountForCommit = (commitHash: string) =>
    new Set(
      reviewComments
        .filter(
          (comment) => !comment.done && comment.commitHash === commitHash,
        )
        .map((comment) => comment.commentId),
    ).size;
  const canAckCommit = (commit: ReviewCommit) =>
    !!currentReviewer &&
    review?.status !== "CLOSED" &&
    commit.status !== "ACKED" &&
    !commitAckedByMe(commit);
  const canMarkCommitReviewed = (commit: ReviewCommit) =>
    !!currentReviewer &&
    review?.status !== "CLOSED" &&
    commit.status !== "ACKED" &&
    commit.status !== "REVIEWED";
  const openCommentCount = new Set(
    reviewComments
      .filter((comment) => !comment.done)
      .map((comment) => comment.commentId),
  ).size;
  const canAckReview =
    !!currentReviewer &&
    !!review &&
    review.status !== "CLOSED" &&
    review.commits.some((commit) => !commitAckedByMe(commit));
  const canMarkReviewReviewed =
    !!currentReviewer &&
    !!review &&
    review.status !== "CLOSED" &&
    review.commits.some(
      (commit) => commit.status !== "ACKED" && commit.status !== "REVIEWED",
    );
  const canCloseReview =
    !!review &&
    review.ownerId === currentUser?.id &&
    review.status === "ACKED";
  const closeReviewDisabledReason = savingCloseReview
    ? t("actionInProgress")
    : !canCloseReview
      ? t("closeReviewRequiresAck")
      : undefined;
  const hasReviewChanges =
    !!review &&
    canEditReviewDetails &&
    (sortedReviewerUserIds(reviewerUserIds).join("\n") !==
      sortedReviewerUserIds(
        review.reviewers.map((reviewer) => reviewer.userId),
      ).join("\n") ||
      reviewTitleDraft.trim() !== (review.title ?? "").trim() ||
      reviewDescriptionDraft.trim() !== (review.description ?? "").trim());

  const reviewStatusLabel = (reviewStatus: ReviewStatus) =>
    t(`reviewStatus${reviewStatus}`);

  const renderUserLabel = (user: ReviewUserSummary) =>
    user.nickname || user.hostname || user.email;

  const reviewTitle = (currentReview: ReviewItem) =>
    currentReview.title ||
    currentReview.gitwebTitle ||
    currentReview.commits[0]?.title ||
    currentReview.gitwebUrl;

  const reviewDescription = (currentReview: ReviewItem) =>
    currentReview.description ||
    currentReview.gitwebLog ||
    currentReview.commits[0]?.rawMessage ||
    "";

  const fullReviewDescription = (currentReview: ReviewItem) =>
    [
      currentReview.description,
      currentReview.gitwebLog,
      currentReview.commits[0]?.rawMessage,
    ].reduce(
      (longestDescription: string, description) =>
        description && description.length > longestDescription.length
          ? description
          : longestDescription,
      "",
    );

  const shortHash = (value: string | null) => value?.slice(0, 12) ?? null;

  const sourceBranchLabel = (currentReview: ReviewItem) =>
    currentReview.sourceBranch || "master";

  const saveReview = async () => {
    if (!idToken || !review || !hasReviewChanges) {
      return;
    }

    const body = {
      ...(canEditReviewDetails
        ? {
            reviewerUserIds,
            ...(reviewTitleDraft.trim() !== (review.title ?? "").trim()
              ? { title: reviewTitleDraft.trim() }
              : {}),
            description: reviewDescriptionDraft.trim() || null,
          }
        : {}),
    };

    setSavingReview(true);
    setErrorMessage("");
    try {
      const nextReview = await apiRequest<ReviewItem>(
        `/v1/reviews/${review.id}`,
        idToken,
        {
          method: "PATCH",
          body: JSON.stringify(body),
        },
      );
      setReview(nextReview);
      showToast(t("reviewSaved"));
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : t("backendError"),
      );
    } finally {
      setSavingReview(false);
    }
  };

  const deleteReview = async () => {
    if (!idToken || !review || !canDeleteReview) {
      return;
    }

    if (!window.confirm(t("confirmDeleteReview"))) {
      return;
    }

    setDeletingReview(true);
    setErrorMessage("");
    try {
      await apiRequest<ReviewDeletion>(`/v1/reviews/${review.id}`, idToken, {
        method: "DELETE",
      });
      showToast(t("reviewDeleted"));
      navigate("/dashboard");
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : t("backendError"),
      );
    } finally {
      setDeletingReview(false);
    }
  };

  const unacknowledgeReview = async () => {
    if (!idToken || !review) {
      return;
    }

    setSavingReviewAck(true);
    setErrorMessage("");
    try {
      const nextReview = await apiRequest<ReviewItem>(
        `/v1/reviews/${review.id}/ack`,
        idToken,
        { method: "DELETE" },
      );
      setReview(nextReview);
      showToast(t("reviewAckWithdrawn"));
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : t("backendError"),
      );
    } finally {
      setSavingReviewAck(false);
    }
  };

  const unacknowledgeCommit = async (commit: ReviewCommit) => {
    if (!idToken || !review) {
      return;
    }

    setSavingCommitAckIds((current) => [...current, commit.id]);
    setErrorMessage("");
    try {
      const nextReview = await apiRequest<ReviewItem>(
        `/v1/reviews/${review.id}/commits/${commit.id}/ack`,
        idToken,
        { method: "DELETE" },
      );
      setReview(nextReview);
      showToast(t("commitAckWithdrawn"));
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : t("backendError"),
      );
    } finally {
      setSavingCommitAckIds((current) =>
        current.filter((commitId) => commitId !== commit.id),
      );
    }
  };

  const acknowledgeReview = async () => {
    if (!idToken || !review || !canAckReview) {
      return;
    }

    setSavingReviewAck(true);
    setErrorMessage("");
    try {
      const nextReview = await apiRequest<ReviewItem>(
        `/v1/reviews/${review.id}/ack`,
        idToken,
        { method: "PATCH" },
      );
      setReview(nextReview);
      showToast(t("reviewAcknowledged"));
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : t("backendError"),
      );
    } finally {
      setSavingReviewAck(false);
    }
  };

  const acknowledgeCommit = async (commit: ReviewCommit) => {
    if (!idToken || !review || !canAckCommit(commit)) {
      return;
    }

    setSavingCommitAckIds((current) => [...current, commit.id]);
    setErrorMessage("");
    try {
      const nextReview = await apiRequest<ReviewItem>(
        `/v1/reviews/${review.id}/commits/${commit.id}/ack`,
        idToken,
        { method: "PATCH" },
      );
      setReview(nextReview);
      showToast(t("commitAcked"));
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : t("backendError"),
      );
    } finally {
      setSavingCommitAckIds((current) =>
        current.filter((commitId) => commitId !== commit.id),
      );
    }
  };

  const markReviewReviewed = async () => {
    if (!idToken || !review || !canMarkReviewReviewed) {
      return;
    }

    setSavingReviewAck(true);
    setErrorMessage("");
    try {
      const nextReview = await apiRequest<ReviewItem>(
        `/v1/reviews/${review.id}/reviewed`,
        idToken,
        { method: "PATCH" },
      );
      setReview(nextReview);
      showToast(t("reviewMarkedReviewed"));
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : t("backendError"),
      );
    } finally {
      setSavingReviewAck(false);
    }
  };

  const markCommitReviewed = async (commit: ReviewCommit) => {
    if (!idToken || !review || !canMarkCommitReviewed(commit)) {
      return;
    }

    setSavingCommitAckIds((current) => [...current, commit.id]);
    setErrorMessage("");
    try {
      const nextReview = await apiRequest<ReviewItem>(
        `/v1/reviews/${review.id}/commits/${commit.id}/reviewed`,
        idToken,
        { method: "PATCH" },
      );
      setReview(nextReview);
      showToast(t("commitMarkedReviewed"));
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : t("backendError"),
      );
    } finally {
      setSavingCommitAckIds((current) =>
        current.filter((commitId) => commitId !== commit.id),
      );
    }
  };

  const closeReview = async () => {
    if (!idToken || !review || !canCloseReview) {
      return;
    }

    setSavingCloseReview(true);
    setErrorMessage("");
    try {
      const nextReview = await apiRequest<ReviewItem>(
        `/v1/reviews/${review.id}/close`,
        idToken,
        { method: "PATCH" },
      );
      setReview(nextReview);
      showToast(t("reviewClosed"));
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : t("backendError"),
      );
    } finally {
      setSavingCloseReview(false);
    }
  };

  const commentTargetLabel = (target: CommentTarget) => {
    const commitPrefix = target.commitHash
      ? `${target.commitHash.slice(0, 12)} - `
      : "";

    if (!target.filePath) {
      if (target.commitHash) {
        return `${commitPrefix}${t("commitLogComment")}`;
      }
      return t("generalReviewComment");
    }

    if (target.lineNumber === null) {
      return `${commitPrefix}${target.filePath}`;
    }

    return `${commitPrefix}${target.filePath}:${target.lineNumber}${
      target.side === "BEFORE" ? ` (${t("commentSideBefore")})` : ""
    }`;
  };

  const targetKey = (target: CommentTarget) =>
    `${target.commitHash ?? ""}:${target.filePath ?? ""}:${target.lineNumber ?? ""}:${target.side}`;

  const diffAnchorId = (target: CommentTarget) =>
    `diff-anchor-${targetKey(target)}`;

  const openDiffLocation = (target: CommentTarget) => {
    const params: Record<string, string> = { tab: "files" };
    if (target.commitHash) {
      params.commit = target.commitHash;
    }
    if (target.filePath) {
      params.file = target.filePath;
    }
    if (target.lineNumber !== null) {
      params.line = String(target.lineNumber);
    }
    if (target.side === "BEFORE") {
      params.side = "BEFORE";
    }

    handledDiffLocationRef.current = null;
    setSearchParams(params);
  };

  const threadDiffAvailable = (thread: ReviewCommentThread) =>
    !!thread.commitHash &&
    !!review?.commits.some((commit) => commit.hash === thread.commitHash);

  const openDiffForThread = (thread: ReviewCommentThread) => {
    if (!threadDiffAvailable(thread)) {
      return;
    }

    openDiffLocation(thread);
  };

  const commentThreadsFrom = (comments: ReviewComment[]): ReviewCommentThread[] => {
    const threadsById = new Map<string, ReviewCommentThread>();

    for (const comment of [...comments].sort(
      (left, right) =>
        new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime(),
    )) {
      const existingThread = threadsById.get(comment.commentId);
      if (existingThread) {
        existingThread.messages.push(comment);
        existingThread.done = comment.done;
        existingThread.doneBy = comment.doneBy;
        existingThread.doneAt = comment.doneAt;
        continue;
      }

      threadsById.set(comment.commentId, {
        commentId: comment.commentId,
        reviewId: comment.reviewId,
        commitHash: comment.commitHash,
        filePath: comment.filePath,
        lineNumber: comment.lineNumber,
        side: comment.side,
        done: comment.done,
        doneBy: comment.doneBy,
        doneAt: comment.doneAt,
        createdAt: comment.createdAt,
        messages: [comment],
      });
    }

    return [...threadsById.values()].sort(
      (left, right) =>
        new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime(),
    );
  };

  const commentThreadsForTarget = (target: CommentTarget) =>
    commentThreadsFrom(
      reviewComments.filter((comment) => targetKey(comment) === targetKey(target)),
    );

  const canDeleteComment = (comment: ReviewComment) =>
    comment.author.id === currentUser?.id;

  const canEditComment = (comment: ReviewComment) =>
    comment.author.id === currentUser?.id;

  const isCommentThreadExpanded = (thread: ReviewCommentThread) =>
    thread.done
      ? expandedCommentIds.includes(thread.commentId)
      : !collapsedCommentIds.includes(thread.commentId);

  const isDiscussionExpanded = (thread: ReviewCommentThread) =>
    expandedDiscussionIds.includes(thread.commentId);

  const toggleDiscussionExpanded = (thread: ReviewCommentThread) => {
    setExpandedDiscussionIds((current) =>
      current.includes(thread.commentId)
        ? current.filter((commentId) => commentId !== thread.commentId)
        : [...current, thread.commentId],
    );
  };

  const toggleCommentThreadExpanded = (thread: ReviewCommentThread) => {
    if (thread.done) {
      setExpandedCommentIds((current) =>
        current.includes(thread.commentId)
          ? current.filter((commentId) => commentId !== thread.commentId)
          : [...current, thread.commentId],
      );
      return;
    }

    setCollapsedCommentIds((current) =>
      current.includes(thread.commentId)
        ? current.filter((commentId) => commentId !== thread.commentId)
        : [...current, thread.commentId],
    );
  };

  const replaceCommentThread = (comments: ReviewComment[]) => {
    const commentId = comments[0]?.commentId;
    if (!commentId) {
      return;
    }

    setReviewComments((current) =>
      [...current.filter((comment) => comment.commentId !== commentId), ...comments].sort(
        (left, right) =>
          new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime(),
      ),
    );
  };

  const updateCommentDone = async (thread: ReviewCommentThread, done: boolean) => {
    if (!idToken || !review || !canUpdateCommentDone) {
      return;
    }

    setSavingDoneCommentIds((current) => [...current, thread.commentId]);
    setErrorMessage("");
    try {
      const comments = await apiRequest<ReviewComment[]>(
        `/v1/reviews/${review.id}/comments/${thread.commentId}`,
        idToken,
        {
          method: "PATCH",
          body: JSON.stringify({ done }),
        },
      );
      replaceCommentThread(comments);
      await refreshReviewSnapshot();
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : t("backendError"),
      );
    } finally {
      setSavingDoneCommentIds((current) =>
        current.filter((commentId) => commentId !== thread.commentId),
      );
    }
  };

  const deleteComment = async (comment: ReviewComment) => {
    if (!idToken || !review || !canDeleteComment(comment)) {
      return;
    }

    if (!window.confirm(t("confirmDeleteComment"))) {
      return;
    }

    setDeletingCommentIds((current) => [...current, comment.id]);
    setErrorMessage("");
    try {
      await apiRequest<ReviewDeletion>(
        `/v1/reviews/${review.id}/comments/${comment.commentId}/messages/${comment.id}`,
        idToken,
        { method: "DELETE" },
      );
      if (editingCommentId === comment.id) {
        setEditingCommentId(null);
        setEditCommentDraft("");
      }
      setReviewComments((current) =>
        current.filter((currentComment) => currentComment.id !== comment.id),
      );
      await refreshReviewSnapshot();
      showToast(t("commentDeleted"));
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : t("backendError"),
      );
    } finally {
      setDeletingCommentIds((current) =>
        current.filter((commentId) => commentId !== comment.id),
      );
    }
  };

  const startEditComment = (comment: ReviewComment) => {
    setEditingCommentId(comment.id);
    setEditCommentDraft(comment.message);
  };

  const cancelEditComment = () => {
    setEditingCommentId(null);
    setEditCommentDraft("");
  };

  const updateCommentMessage = async (comment: ReviewComment) => {
    const message = editCommentDraft.trim();
    if (!idToken || !review || !canEditComment(comment) || !message) {
      return;
    }

    setSavingEditCommentIds((current) => [...current, comment.id]);
    setErrorMessage("");
    try {
      const comments = await apiRequest<ReviewComment[]>(
        `/v1/reviews/${review.id}/comments/${comment.commentId}/messages/${comment.id}`,
        idToken,
        {
          method: "PATCH",
          body: JSON.stringify({ message }),
        },
      );
      replaceCommentThread(comments);
      setEditingCommentId(null);
      setEditCommentDraft("");
      showToast(t("commentUpdated"));
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : t("backendError"),
      );
    } finally {
      setSavingEditCommentIds((current) =>
        current.filter((commentId) => commentId !== comment.id),
      );
    }
  };

  const addCommentReply = async (thread: ReviewCommentThread) => {
    const message = (replyDrafts[thread.commentId] ?? "").trim();
    if (!idToken || !review || !message) {
      return;
    }

    setSavingReplyCommentIds((current) => [...current, thread.commentId]);
    setErrorMessage("");
    try {
      const comments = await apiRequest<ReviewComment[]>(
        `/v1/reviews/${review.id}/comments/${thread.commentId}/messages`,
        idToken,
        {
          method: "POST",
          body: JSON.stringify({ message }),
        },
      );
      replaceCommentThread(comments);
      setReplyDrafts((current) => ({ ...current, [thread.commentId]: "" }));
      await refreshReviewSnapshot();
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : t("backendError"),
      );
    } finally {
      setSavingReplyCommentIds((current) =>
        current.filter((commentId) => commentId !== thread.commentId),
      );
    }
  };

  const toggleInlineComment = (target: CommentTarget) => {
    if (inlineCommentTarget && targetKey(inlineCommentTarget) === targetKey(target)) {
      setInlineCommentTarget(null);
      return;
    }

    setInlineCommentTarget(target);
  };

  const createReviewComment = async (target: CommentTarget, message: string) => {
    if (!idToken || !review) {
      return null;
    }

    return apiRequest<ReviewComment>(
      `/v1/reviews/${review.id}/comments`,
      idToken,
      {
        method: "POST",
        body: JSON.stringify({
          ...target,
          message,
        }),
      },
    );
  };

  const addInlineComment = async (message: string) => {
    if (!inlineCommentTarget || !message) {
      return;
    }

    setSavingComment(true);
    setErrorMessage("");
    try {
      const comment = await createReviewComment(inlineCommentTarget, message);
      if (comment) {
        setReviewComments((current) => [...current, comment]);
        setInlineCommentTarget(null);
        await refreshReviewSnapshot();
      }
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : t("backendError"),
      );
    } finally {
      setSavingComment(false);
    }
  };

  const renderMarkdown = (value: string) => <MarkdownView value={value} />;

  const commentMessageActions: CommentMessageActions = {
    renderUserLabel,
    editingCommentId,
    editCommentDraft,
    savingEditCommentIds,
    deletingCommentIds,
    canEditComment,
    canDeleteComment,
    onStartEdit: startEditComment,
    onCancelEdit: cancelEditComment,
    onEditDraftChange: setEditCommentDraft,
    onUpdateMessage: (comment) => void updateCommentMessage(comment),
    onDeleteComment: (comment) => void deleteComment(comment),
  };

  const renderInlineCommentComposer = () => (
    <InlineCommentComposer
      saving={savingComment}
      labels={{
        placeholder: t("markdownCommentPlaceholder"),
        cancel: t("cancel"),
        submit: t("addComment"),
        previewEmpty: t("markdownPreviewEmpty"),
      }}
      renderMarkdown={renderMarkdown}
      onCancel={() => setInlineCommentTarget(null)}
      onSubmit={(message) => void addInlineComment(message)}
    />
  );

  const renderInlineCommentThreads = (threads: ReviewCommentThread[]) =>
    threads.length ? (
      <div className="diff-inline-comments">
        {threads.map((thread) => (
          <div
            className={`diff-inline-comment${thread.done ? " is-done" : ""}`}
            key={thread.commentId}
          >
            <div
              aria-expanded={isCommentThreadExpanded(thread)}
              className="diff-inline-comment-meta comment-thread-header"
              role="button"
              tabIndex={0}
              onClick={() => toggleCommentThreadExpanded(thread)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  toggleCommentThreadExpanded(thread);
                }
              }}
            >
              <span className="fw-semibold">
                {renderUserLabel(thread.messages[0].author)}
              </span>
              <DateTimeText
                label={t("createdAt")}
                value={thread.createdAt}
              />
              <CommentThreadControls
                thread={thread}
                targetLabel={commentTargetLabel(thread)}
                canUpdateDone={canUpdateCommentDone}
                savingDone={savingDoneCommentIds.includes(thread.commentId)}
                onToggleDone={() => void updateCommentDone(thread, !thread.done)}
              />
            </div>
            {isCommentThreadExpanded(thread) ? (
              <>
                <CommentMessages thread={thread} actions={commentMessageActions} />
                <CommentDoneMeta thread={thread} renderUserLabel={renderUserLabel} />
                <CommentReplyForm
                  thread={thread}
                  draft={replyDrafts[thread.commentId] ?? ""}
                  saving={savingReplyCommentIds.includes(thread.commentId)}
                  onDraftChange={(value) =>
                    setReplyDrafts((current) => ({
                      ...current,
                      [thread.commentId]: value,
                    }))
                  }
                  onSubmit={() => void addCommentReply(thread)}
                />
              </>
            ) : null}
          </div>
        ))}
      </div>
    ) : null;

  if (!review && loadingReview) {
    return (
      <div className="card">
        <div className="card-body d-flex align-items-center gap-3">
          <span className="spinner-border text-primary" />
          <span>{t("loadingReview")}</span>
        </div>
      </div>
    );
  }

  if (!review) {
    return (
      <div className="card card-danger card-outline">
        <div className="card-body">
          <p className="text-secondary">
            {errorMessage || t("reviewNotFound")}
          </p>
        </div>
      </div>
    );
  }

  const reviewCommentThreads = commentThreadsFrom(reviewComments);
  const generalCommentTarget = {
    commitHash: null,
    filePath: null,
    lineNumber: null,
    side: "AFTER",
  } satisfies CommentTarget;
  const generalCommentThreads = commentThreadsForTarget(generalCommentTarget);
  const activeCommit =
    review.commits.find((commit) => commit.id === activeCommitId) ??
    review.commits[0] ??
    null;
  const commitLogTarget = activeCommit
    ? ({
        commitHash: activeCommit.hash,
        filePath: null,
        lineNumber: null,
        side: "AFTER",
      } satisfies CommentTarget)
    : null;
  const activeCommitIndex = activeCommit
    ? review.commits.findIndex((commit) => commit.id === activeCommit.id)
    : -1;
  const activeCommitHasComments =
    !!activeCommit &&
    reviewComments.some(
      (comment) => comment.commitHash === activeCommit.hash,
    );
  const scrollToNextComment = () => {
    const elements = [
      ...document.querySelectorAll<HTMLElement>(".diff-inline-comment"),
    ];
    if (!elements.length) {
      return;
    }

    const next =
      elements.find(
        (element) =>
          element.getBoundingClientRect().top > window.innerHeight / 2 + 24,
      ) ?? elements[0];
    next.scrollIntoView({ behavior: "smooth", block: "center" });
    next.classList.add("diff-anchor-highlight");
    window.setTimeout(() => {
      next.classList.remove("diff-anchor-highlight");
    }, 2000);
  };
  const commitDiffFiles = (commit: ReviewCommit) =>
    commit.gitDiff.files.length || review.commits.length > 1
      ? commit.gitDiff.files
      : review.gitDiff.files;
  const ackedCommitCount = review.commits.filter(
    (commit) => commit.status === "ACKED",
  ).length;
  const totalDiffFileCount = review.commits.length
    ? review.commits.reduce(
        (sum, commit) => sum + commitDiffFiles(commit).length,
        0,
      )
    : review.gitDiff.files.length;

  return (
    <div className="review-page">
      <ReviewHeader
        review={review}
        currentUserId={currentUser?.id}
        isReviewer={!!currentReviewer}
        title={reviewTitle(review)}
        ownerLabel={renderUserLabel(review.owner)}
        statusLabel={reviewStatusLabel(review.status)}
        loadingReview={loadingReview}
        ackedCommitCount={ackedCommitCount}
        activeTab={activeReviewTab}
        onTabChange={setActiveReviewTab}
        totalDiffFileCount={totalDiffFileCount}
        commentThreadCount={reviewCommentThreads.length}
        commitAckedByMe={commitAckedByMe}
        reviewActionMenuOpen={reviewActionMenuOpen}
        setReviewActionMenuOpen={setReviewActionMenuOpen}
        savingReviewAck={savingReviewAck}
        canAckReview={canAckReview}
        canMarkReviewReviewed={canMarkReviewReviewed}
        openCommentCount={openCommentCount}
        onAcknowledgeReview={() => void acknowledgeReview()}
        onMarkReviewReviewed={() => void markReviewReviewed()}
        onUnacknowledgeReview={() => void unacknowledgeReview()}
        loadingSyncPreview={loadingSyncPreview}
        syncingReview={syncingReview}
        onOpenSyncModal={() => void openSyncModal()}
        canCloseReview={canCloseReview}
        closeReviewDisabledReason={closeReviewDisabledReason}
        savingCloseReview={savingCloseReview}
        onCloseReview={() => void closeReview()}
        canDeleteReview={canDeleteReview}
        deletingReview={deletingReview}
        onDeleteReview={() => void deleteReview()}
      />

      {errorMessage ? (
        <div className="alert alert-danger">{errorMessage}</div>
      ) : null}

      <div className="card card-info card-outline review-workbench">
        {activeReviewTab === "overview" ? (
          <OverviewTabPanel
            review={review}
            idToken={idToken}
            canEditReviewDetails={canEditReviewDetails}
            titleDraft={reviewTitleDraft}
            onTitleDraftChange={setReviewTitleDraft}
            descriptionDraft={reviewDescriptionDraft}
            onDescriptionDraftChange={setReviewDescriptionDraft}
            reviewTitleText={reviewTitle(review)}
            collapsedDescription={reviewDescription(review)}
            fullDescription={fullReviewDescription(review)}
            descriptionExpanded={descriptionExpanded}
            onToggleDescriptionExpanded={() =>
              setDescriptionExpanded((current) => !current)
            }
            commitLogLinkRules={commitLogLinkRules}
            sourceBranchLabelText={sourceBranchLabel(review)}
            sourceCommitLabel={shortHash(review.sourceCommit)}
            renderUserLabel={renderUserLabel}
            reviewerUserIds={reviewerUserIds}
            onReviewersChange={setReviewerUserIds}
            reviewFieldDefs={reviewFieldDefs}
            fieldValueDrafts={fieldValueDrafts}
            onFieldDraftChange={(fieldId, value) =>
              setFieldValueDrafts((current) => ({
                ...current,
                [fieldId]: value,
              }))
            }
            savedFieldValue={savedFieldValue}
            fieldPlaceholder={fieldPlaceholder}
            savingFieldIds={savingFieldIds}
            onSaveFieldValue={(fieldId) => void saveFieldValue(fieldId)}
            hasReviewChanges={hasReviewChanges}
            savingReview={savingReview}
            onSaveReview={() => void saveReview()}
            generalCommentTarget={generalCommentTarget}
            inlineCommentTarget={inlineCommentTarget}
            targetKey={targetKey}
            toggleInlineComment={toggleInlineComment}
            renderInlineCommentComposer={renderInlineCommentComposer}
            renderInlineCommentThreads={renderInlineCommentThreads}
            generalCommentThreads={generalCommentThreads}
          />
        ) : null}

        {activeReviewTab === "files" ? (
          <FilesTabPanel
            review={review}
            currentUserId={currentUser?.id}
            isReviewer={!!currentReviewer}
            activeCommit={activeCommit}
            activeCommitIndex={activeCommitIndex}
            activeCommitHasComments={activeCommitHasComments}
            commitLogTarget={commitLogTarget}
            commitNavOpen={commitNavOpen}
            onToggleCommitNav={() => setCommitNavOpen((current) => !current)}
            onSelectCommit={(commitId) => {
              setActiveCommitId(commitId);
              setCommitNavOpen(false);
            }}
            onScrollToNextComment={scrollToNextComment}
            commitLogLinkRules={commitLogLinkRules}
            inlineCommentTarget={inlineCommentTarget}
            targetKey={targetKey}
            commentThreadsForTarget={commentThreadsForTarget}
            toggleInlineComment={toggleInlineComment}
            renderInlineCommentComposer={renderInlineCommentComposer}
            renderInlineCommentThreads={renderInlineCommentThreads}
            diffAnchorId={diffAnchorId}
            fileViewKey={fileViewKey}
            isFileViewedByMe={isFileViewedByMe}
            expandedFileKeys={expandedFileKeys}
            setExpandedFileKeys={setExpandedFileKeys}
            savingFileViewKeys={savingFileViewKeys}
            toggleFileViewed={(commit, filePath) =>
              void toggleFileViewed(commit, filePath)
            }
            openDiffLocation={openDiffLocation}
            commitDiffFiles={commitDiffFiles}
            renderUserLabel={renderUserLabel}
            commitAckedByMe={commitAckedByMe}
            savingCommitAckIds={savingCommitAckIds}
            unacknowledgeCommit={(commit) => void unacknowledgeCommit(commit)}
            commitActionMenuOpenId={commitActionMenuOpenId}
            setCommitActionMenuOpenId={setCommitActionMenuOpenId}
            canAckCommit={canAckCommit}
            canMarkCommitReviewed={canMarkCommitReviewed}
            openCommentCountForCommit={openCommentCountForCommit}
            acknowledgeCommit={(commit) => void acknowledgeCommit(commit)}
            markCommitReviewed={(commit) => void markCommitReviewed(commit)}
          />
        ) : null}

        {activeReviewTab === "comments" ? (
          <CommentsTabPanel
            threads={reviewCommentThreads}
            isDiscussionExpanded={isDiscussionExpanded}
            onToggleDiscussion={toggleDiscussionExpanded}
            threadDiffAvailable={threadDiffAvailable}
            onOpenDiffForThread={openDiffForThread}
            renderUserLabel={renderUserLabel}
            messageActions={commentMessageActions}
            threadTargetLabel={commentTargetLabel}
            canUpdateDone={canUpdateCommentDone}
            savingDoneCommentIds={savingDoneCommentIds}
            onToggleDone={(thread, done) => void updateCommentDone(thread, done)}
            replyDrafts={replyDrafts}
            savingReplyCommentIds={savingReplyCommentIds}
            onReplyDraftChange={(commentId, value) =>
              setReplyDrafts((current) => ({
                ...current,
                [commentId]: value,
              }))
            }
            onSubmitReply={(thread) => void addCommentReply(thread)}
          />
        ) : null}
      </div>

      {syncModalOpen ? (
        <SyncModal
          syncPreview={syncPreview}
          loadingSyncPreview={loadingSyncPreview}
          syncCommitHashes={syncCommitHashes}
          syncingReview={syncingReview}
          onToggleCommit={toggleSyncCommit}
          onClose={closeSyncModal}
          onApply={() => void applySync()}
        />
      ) : null}
    </div>
  );
}
