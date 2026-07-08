import { type ReactNode, useEffect, useRef, useState } from "react";
import hljs from "highlight.js/lib/core";
import bash from "highlight.js/lib/languages/bash";
import c from "highlight.js/lib/languages/c";
import cpp from "highlight.js/lib/languages/cpp";
import css from "highlight.js/lib/languages/css";
import diff from "highlight.js/lib/languages/diff";
import dockerfile from "highlight.js/lib/languages/dockerfile";
import go from "highlight.js/lib/languages/go";
import ini from "highlight.js/lib/languages/ini";
import javascript from "highlight.js/lib/languages/javascript";
import json from "highlight.js/lib/languages/json";
import markdown from "highlight.js/lib/languages/markdown";
import python from "highlight.js/lib/languages/python";
import typescript from "highlight.js/lib/languages/typescript";
import xml from "highlight.js/lib/languages/xml";
import yaml from "highlight.js/lib/languages/yaml";
import ReactMarkdown from "react-markdown";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import remarkGfm from "remark-gfm";
import { apiRequest } from "../api/client";
import { useAuth } from "../auth/AuthProvider";
import { ReviewerSearchSelect } from "../components/ReviewerSearchSelect";
import { useI18n } from "../i18n/I18nProvider";
import { useToast } from "../layout/ToastProvider";
import {
  realtimeNotificationEvent,
  type RealtimeNotificationEvent,
} from "../realtime/events";
import type {
  CommitLogLinkRule,
  ReviewComment,
  ReviewCommentSide,
  ReviewCommit,
  ReviewCommitChangeKind,
  ReviewDeletion,
  ReviewField,
  ReviewItem,
  ReviewStatus,
  ReviewSyncPreview,
  ReviewUserSummary,
} from "../types/api";
import {
  reviewCommitStatusBadgeClass,
  reviewStatusBadgeClass,
} from "../utils/reviewStatus";
import { gitwebFetchErrorLabel } from "../utils/gitwebFetchError";

hljs.registerLanguage("bash", bash);
hljs.registerLanguage("c", c);
hljs.registerLanguage("cpp", cpp);
hljs.registerLanguage("css", css);
hljs.registerLanguage("diff", diff);
hljs.registerLanguage("dockerfile", dockerfile);
hljs.registerLanguage("go", go);
hljs.registerLanguage("ini", ini);
hljs.registerLanguage("javascript", javascript);
hljs.registerLanguage("json", json);
hljs.registerLanguage("markdown", markdown);
hljs.registerLanguage("python", python);
hljs.registerLanguage("typescript", typescript);
hljs.registerLanguage("xml", xml);
hljs.registerLanguage("yaml", yaml);

const languageByExtension: Record<string, string> = {
  c: "c",
  cc: "cpp",
  conf: "ini",
  cpp: "cpp",
  css: "css",
  go: "go",
  hpp: "cpp",
  html: "xml",
  js: "javascript",
  json: "json",
  jsx: "javascript",
  md: "markdown",
  patch: "diff",
  xml: "xml",
  yaml: "yaml",
  yml: "yaml",
};

const languageAliases: Record<string, string> = {
  docker: "dockerfile",
  htm: "xml",
  js: "javascript",
  jsx: "javascript",
  md: "markdown",
  patch: "diff",
  py: "python",
  shell: "bash",
  sh: "bash",
  ts: "typescript",
  yml: "yaml",
  zsh: "bash",
};

const normalizeLanguage = (language: string | null | undefined) => {
  if (!language) {
    return null;
  }

  return languageAliases[language] ?? language;
};

const languageForPath = (path: string) => {
  const extension = path.split(".").pop();

  return extension ? languageByExtension[extension.toLowerCase()] : null;
};

const languageFromClassName = (className: string | undefined) => {
  const match = /(?:^|\s)language-([^\s]+)/.exec(className ?? "");

  return normalizeLanguage(match?.[1]);
};

const highlightCacheLimit = 50000;
const highlightCache = new Map<string, string>();

function InlineCommentComposer({
  saving,
  labels,
  renderMarkdown,
  onCancel,
  onSubmit,
}: {
  saving: boolean;
  labels: {
    placeholder: string;
    cancel: string;
    submit: string;
    previewEmpty: string;
  };
  renderMarkdown: (value: string) => ReactNode;
  onCancel: () => void;
  onSubmit: (message: string) => void;
}) {
  const [draft, setDraft] = useState("");

  return (
    <div className="diff-inline-comment-panel">
      <div className="diff-inline-comment-editor">
        <textarea
          className="form-control"
          rows={4}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder={labels.placeholder}
        />
        <div className="diff-inline-comment-actions">
          <button
            className="btn btn-outline-secondary btn-sm"
            type="button"
            onClick={onCancel}
          >
            {labels.cancel}
          </button>
          <button
            className="btn btn-primary btn-sm"
            type="button"
            disabled={!draft.trim() || saving}
            onClick={() => onSubmit(draft.trim())}
          >
            {labels.submit}
          </button>
        </div>
      </div>
      <div className="diff-inline-comment-preview markdown-body">
        {draft.trim() ? renderMarkdown(draft) : labels.previewEmpty}
      </div>
    </div>
  );
}

const codeFromDiffLine = (line: string) => {
  if (
    (line.startsWith("+") && !line.startsWith("+++")) ||
    (line.startsWith("-") && !line.startsWith("---")) ||
    line.startsWith(" ")
  ) {
    return line.slice(1);
  }

  return line;
};

type DiffRenderRow =
  | {
      kind: "hunk";
      key: string;
      text: string;
    }
  | {
      kind: "line";
      key: string;
      text: string;
      lineNumber: number | null;
      side: ReviewCommentSide;
    };

const diffHunkHeaderPattern = /^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/;

const diffRenderRows = (patch: string): DiffRenderRow[] => {
  let oldLineNumber = 0;
  let newLineNumber = 0;
  let insideHunk = false;

  return patch.split("\n").map((line, index) => {
    const hunkMatch = diffHunkHeaderPattern.exec(line);
    if (hunkMatch) {
      oldLineNumber = Number(hunkMatch[1]);
      newLineNumber = Number(hunkMatch[2]);
      insideHunk = true;

      return {
        kind: "hunk",
        key: `hunk-${index}`,
        text: line,
      };
    }

    if (!insideHunk) {
      return {
        kind: "line",
        key: `metadata-${index}`,
        text: line,
        lineNumber: null,
        side: "AFTER",
      };
    }

    if (line.startsWith("+") && !line.startsWith("+++")) {
      const lineNumber = newLineNumber;
      newLineNumber += 1;
      return {
        kind: "line",
        key: `line-${index}`,
        text: line,
        lineNumber,
        side: "AFTER",
      };
    }

    if (line.startsWith("-") && !line.startsWith("---")) {
      const lineNumber = oldLineNumber;
      oldLineNumber += 1;
      return {
        kind: "line",
        key: `line-${index}`,
        text: line,
        lineNumber,
        side: "BEFORE",
      };
    }

    if (line.startsWith(" ")) {
      const lineNumber = newLineNumber;
      oldLineNumber += 1;
      newLineNumber += 1;
      return {
        kind: "line",
        key: `line-${index}`,
        text: line,
        lineNumber,
        side: "AFTER",
      };
    }

    return {
      kind: "line",
      key: `metadata-${index}`,
      text: line,
      lineNumber: null,
      side: "AFTER",
    };
  });
};

const stringFromPayload = (
  payload: Record<string, unknown>,
  key: string,
) => (typeof payload[key] === "string" ? payload[key] : null);

const shortHostname = (hostname: string) => hostname.split(".")[0] ?? hostname;

const notificationMatchesReview = (
  event: RealtimeNotificationEvent,
  currentReview: ReviewItem,
) => {
  if (typeof event.payload !== "object" || event.payload === null) {
    return false;
  }

  const payload = event.payload as Record<string, unknown>;
  const eventReviewId = stringFromPayload(payload, "reviewId");
  const eventCommit =
    stringFromPayload(payload, "sourceCommit") ??
    stringFromPayload(payload, "commitHash");

  return (
    eventReviewId === currentReview.id ||
    (!!eventCommit && eventCommit === currentReview.sourceCommit)
  );
};

type ReviewTab = "overview" | "files" | "comments";

type CommentTarget = {
  commitHash: string | null;
  filePath: string | null;
  lineNumber: number | null;
  side: ReviewCommentSide;
};

type ReviewCommentThread = CommentTarget & {
  commentId: string;
  reviewId: string;
  done: boolean;
  doneBy: ReviewComment["doneBy"];
  doneAt: string | null;
  createdAt: string;
  messages: ReviewComment[];
};

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

  const changeKindBadgeClass = (kind: ReviewCommitChangeKind) => {
    switch (kind) {
      case "NEW":
        return "text-bg-info";
      case "MODIFIED":
        return "text-bg-warning";
      case "REBASED":
        return "text-bg-secondary";
      default:
        return "review-meta-badge";
    }
  };

  const commitChangeKindBadge = (commit: ReviewCommit) =>
    review && review.version > 1 && commit.changeKind ? (
      <span
        className={`badge ${changeKindBadgeClass(commit.changeKind)} flex-shrink-0`}
      >
        {t(`changeKind${commit.changeKind}`)}
      </span>
    ) : null;

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
    sortedReviewerUserIds(reviewerUserIds).join("\n") !==
      sortedReviewerUserIds(
        review.reviewers.map((reviewer) => reviewer.userId),
      ).join("\n");

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

  const renderMarkdown = (value: string) => (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        a: ({ children, ...props }) => (
          <a {...props} rel="noreferrer" target="_blank">
            {children}
          </a>
        ),
        code: ({ className, children, node: _node, ...props }) => {
          const code = String(children).replace(/\n$/, "");
          const language = languageFromClassName(className);

          if (!language) {
            return (
              <code className={className} {...props}>
                {children}
              </code>
            );
          }

          const highlighted = hljs.getLanguage(language)
            ? hljs.highlight(code, { language }).value
            : hljs.highlightAuto(code).value;

          return (
            <code
              className={`hljs language-${language}`}
              {...props}
              dangerouslySetInnerHTML={{ __html: highlighted || " " }}
            />
          );
        },
      }}
    >
      {value}
    </ReactMarkdown>
  );

  const renderCommentMessages = (thread: ReviewCommentThread) => (
    <div className="review-comment-messages">
      {thread.messages.map((comment, index) => {
        const previousComment = thread.messages[index - 1];
        const repeatedAuthor = previousComment?.author.id === comment.author.id;
        const editing = editingCommentId === comment.id;
        const savingEdit = savingEditCommentIds.includes(comment.id);
        const canEdit = canEditComment(comment) && !editing;
        const canDelete = canDeleteComment(comment);
        const showMeta = !repeatedAuthor || canEdit || canDelete;

        return (
          <div className="review-comment-message" key={comment.id}>
            {showMeta ? (
              <div
                className={`review-comment-message-meta${
                  repeatedAuthor ? " is-compact" : ""
                }`}
              >
                {!repeatedAuthor ? (
                  <>
                    <span className="fw-semibold">
                      {renderUserLabel(comment.author)}
                    </span>
                    <span>{new Date(comment.createdAt).toLocaleString()}</span>
                  </>
                ) : null}
                {canEdit ? (
                  <button
                    aria-label={t("editComment")}
                    className="btn btn-sm border-0 p-1"
                    title={t("editComment")}
                    type="button"
                    onClick={() => startEditComment(comment)}
                  >
                    <i className="bi bi-pencil" aria-hidden="true" />
                  </button>
                ) : null}
                {canDelete ? (
                  <button
                    aria-label={t("deleteComment")}
                    className="btn btn-sm border-0 p-1 text-danger"
                    disabled={deletingCommentIds.includes(comment.id)}
                    title={t("deleteComment")}
                    type="button"
                    onClick={() => void deleteComment(comment)}
                  >
                    {deletingCommentIds.includes(comment.id) ? (
                      <span className="spinner-border spinner-border-sm" />
                    ) : (
                      <i className="bi bi-trash" aria-hidden="true" />
                    )}
                  </button>
                ) : null}
              </div>
            ) : null}
            {editing ? (
              <div className="review-comment-edit">
                <textarea
                  className="form-control form-control-sm"
                  rows={3}
                  value={editCommentDraft}
                  onChange={(event) => setEditCommentDraft(event.target.value)}
                />
                <div className="d-flex justify-content-end gap-2 mt-2">
                  <button
                    className="btn btn-outline-secondary btn-sm"
                    disabled={savingEdit}
                    type="button"
                    onClick={cancelEditComment}
                  >
                    {t("cancel")}
                  </button>
                  <button
                    className="btn btn-primary btn-sm"
                    disabled={!editCommentDraft.trim() || savingEdit}
                    type="button"
                    onClick={() => void updateCommentMessage(comment)}
                  >
                    {savingEdit ? (
                      <span className="spinner-border spinner-border-sm me-1" />
                    ) : null}
                    {t("save")}
                  </button>
                </div>
              </div>
            ) : (
              <div className="markdown-body">{renderMarkdown(comment.message)}</div>
            )}
          </div>
        );
      })}
    </div>
  );

  const renderCommentReplyForm = (thread: ReviewCommentThread) => {
    const replyDraft = replyDrafts[thread.commentId] ?? "";
    const savingReply = savingReplyCommentIds.includes(thread.commentId);

    return (
      <div className="review-comment-reply">
        <textarea
          className="form-control form-control-sm"
          rows={2}
          value={replyDraft}
          onChange={(event) =>
            setReplyDrafts((current) => ({
              ...current,
              [thread.commentId]: event.target.value,
            }))
          }
          placeholder={t("replyCommentPlaceholder")}
        />
        <div className="d-flex justify-content-end mt-2">
          <button
            className="btn btn-primary btn-sm"
            disabled={!replyDraft.trim() || savingReply}
            type="button"
            onClick={() => void addCommentReply(thread)}
          >
            {savingReply ? (
              <span className="spinner-border spinner-border-sm me-1" />
            ) : null}
            {t("replyComment")}
          </button>
        </div>
      </div>
    );
  };

  const renderCommentThreadControls = (
    thread: ReviewCommentThread,
    showTargetLabel = false,
  ) => {
    return (
      <>
        <span className="badge review-meta-badge">
          {thread.messages.length} {t("commentMessages")}
        </span>
        {thread.done ? (
          <span className="badge text-bg-success">{t("commentDone")}</span>
        ) : null}
        {showTargetLabel ? (
          <span className="badge text-bg-secondary">
            {commentTargetLabel(thread)}
          </span>
        ) : null}
        {canUpdateCommentDone ? (
          <button
            className={`btn btn-sm border-0 p-1 ${thread.done ? "text-secondary" : "text-success"}`}
            disabled={savingDoneCommentIds.includes(thread.commentId)}
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              void updateCommentDone(thread, !thread.done);
            }}
          >
            {thread.done ? t("reopenComment") : t("markCommentDone")}
          </button>
        ) : null}
      </>
    );
  };

  const diffLineClass = (line: string) => {
    if (line.startsWith("+") && !line.startsWith("+++")) {
      return "diff-line-added";
    }
    if (line.startsWith("-") && !line.startsWith("---")) {
      return "diff-line-removed";
    }
    return "diff-line-context";
  };

  const highlightedCode = (line: string, language: string | null) => {
    const cacheKey = `${language ?? ""}\u0000${line}`;
    const cached = highlightCache.get(cacheKey);
    if (cached !== undefined) {
      return { __html: cached };
    }

    const code = codeFromDiffLine(line);
    const trailingMatch = code.match(/[ \t]+$/);
    const trailing = trailingMatch?.[0] ?? "";
    const core = trailing ? code.slice(0, code.length - trailing.length) : code;
    const trailingHtml = trailing
      ? `<span class="diff-trailing-whitespace">${trailing}</span>`
      : "";

    const normalizedLanguage = normalizeLanguage(language);
    const coreHtml =
      !normalizedLanguage || !hljs.getLanguage(normalizedLanguage)
        ? hljs.highlightAuto(core).value
        : hljs.highlight(core, { language: normalizedLanguage }).value;

    const html = coreHtml + trailingHtml || " ";
    if (highlightCache.size >= highlightCacheLimit) {
      highlightCache.clear();
    }
    highlightCache.set(cacheKey, html);
    return { __html: html };
  };

  const gitwebParams = (gitwebUrl: string) => {
    const params = new Map<string, string>();
    const query = gitwebUrl.split("?")[1] ?? "";

    for (const segment of query.split(/[&;]/)) {
      const [key, ...valueParts] = segment.split("=");
      if (!key) {
        continue;
      }
      params.set(
        decodeURIComponent(key),
        decodeURIComponent(valueParts.join("=")),
      );
    }

    return params;
  };

  const gitwebTemplateVariables = (currentReview: ReviewItem) => {
    const params = gitwebParams(currentReview.gitwebUrl);
    const project = params.get("p") ?? "";
    const [username = "", rawComponent = ""] = project.split("/");
    const component = rawComponent.replace(/\.git$/, "");

    try {
      const url = new URL(currentReview.gitwebUrl);
      return {
        USERNAME: username,
        HOSTNAME: shortHostname(url.hostname),
        COMPONENT: component,
        HASH: params.get("h") ?? currentReview.sourceCommit ?? "",
      };
    } catch {
      return {
        USERNAME: username,
        HOSTNAME: "",
        COMPONENT: component,
        HASH: params.get("h") ?? currentReview.sourceCommit ?? "",
      };
    }
  };

  const hrefFromRule = (
    rule: CommitLogLinkRule,
    match: RegExpExecArray,
    templateVariables: Record<string, string>,
  ) =>
    rule.linkTemplate.replace(/\$\{([^}]+)\}/g, (_token, groupName) => {
      const indexedGroup = Number(groupName);
      if (Number.isInteger(indexedGroup)) {
        return match[indexedGroup] ?? "";
      }

      return match.groups?.[groupName] ?? templateVariables[groupName] ?? "";
    });

  const linkedCommitLog = (
    text: string,
    currentReview: ReviewItem,
  ): ReactNode[] => {
    const nodes: ReactNode[] = [];
    let cursor = 0;
    const templateVariables = gitwebTemplateVariables(currentReview);

    while (cursor < text.length) {
      let bestMatch:
        | { rule: CommitLogLinkRule; match: RegExpExecArray }
        | null = null;

      for (const rule of commitLogLinkRules) {
        if (!rule.enabled) {
          continue;
        }

        try {
          const regex = new RegExp(rule.regex, "g");
          regex.lastIndex = cursor;
          const match = regex.exec(text);
          if (!match || match.index < cursor || match[0].length === 0) {
            continue;
          }
          if (!bestMatch || match.index < bestMatch.match.index) {
            bestMatch = { rule, match };
          }
        } catch {
          continue;
        }
      }

      if (!bestMatch) {
        nodes.push(text.slice(cursor));
        break;
      }

      const { rule, match } = bestMatch;
      if (match.index > cursor) {
        nodes.push(text.slice(cursor, match.index));
      }
      nodes.push(
        <a
          className="commit-log-link"
          href={hrefFromRule(rule, match, templateVariables)}
          key={`${match.index}-${match[0]}`}
          rel="noreferrer"
          target="_blank"
        >
          {match[0]}
        </a>,
      );
      cursor = match.index + match[0].length;
    }

    return nodes;
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
              <span>{new Date(thread.createdAt).toLocaleString()}</span>
              {renderCommentThreadControls(thread)}
            </div>
            {isCommentThreadExpanded(thread) ? (
              <>
                {renderCommentMessages(thread)}
                {thread.done && thread.doneAt ? (
                  <div className="comment-done-meta">
                    {t("commentDoneBy")} {thread.doneBy ? renderUserLabel(thread.doneBy) : t("notAvailable")} - {new Date(thread.doneAt).toLocaleString()}
                  </div>
                ) : null}
                {renderCommentReplyForm(thread)}
              </>
            ) : null}
          </div>
        ))}
      </div>
    ) : null;

  const renderGitDiff = (commit: ReviewCommit, diffFiles: ReviewItem["gitDiff"]["files"]) => {
    if (diffFiles.length === 0) {
      return (
        <div className="empty-state border rounded">
          {t("diffNotAvailable")}
        </div>
      );
    }

    return diffFiles.map((file) => {
      const rows = diffRenderRows(file.patch);
      const language = languageForPath(file.path);
      const fileTarget = {
        commitHash: commit.hash,
        filePath: file.path,
        lineNumber: null,
        side: "AFTER",
      } satisfies CommentTarget;
      const fileCommentThreads = commentThreadsForTarget(fileTarget);
      const fileComposerOpen =
        !!inlineCommentTarget &&
        targetKey(inlineCommentTarget) === targetKey(fileTarget);
      const viewKey = fileViewKey(commit.id, file.path);
      const viewed = isFileViewedByMe(commit, file.path);
      const fileExpanded = expandedFileKeys[viewKey] ?? !viewed;
      const canMarkViewed =
        review?.ownerId === currentUser?.id || !!currentReviewer;

      return (
        <div
          className="card mb-3"
          id={diffAnchorId(fileTarget)}
          key={`${commit.hash}-${file.path}`}
        >
          <div
            aria-expanded={fileExpanded}
            className="card-header py-1 d-flex align-items-center justify-content-between gap-3 diff-file-header"
            role="button"
            tabIndex={0}
            onClick={() =>
              setExpandedFileKeys((current) => ({
                ...current,
                [viewKey]: !fileExpanded,
              }))
            }
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                setExpandedFileKeys((current) => ({
                  ...current,
                  [viewKey]: !fileExpanded,
                }));
              }
            }}
          >
            <div>
              <i
                className={`bi ${fileExpanded ? "bi-chevron-down" : "bi-chevron-right"} me-2`}
                aria-hidden="true"
              />
              <span className="fw-semibold">{file.path}</span>
              <span className="badge text-bg-secondary ms-2">{file.status}</span>
              <span className="badge text-bg-success ms-2">
                +{file.additions}
              </span>
              <span className="badge text-bg-danger ms-1">
                -{file.deletions}
              </span>
              {file.oldPath ? (
                <span className="d-block small text-secondary">
                  {file.oldPath}
                </span>
              ) : null}
            </div>
            <div
              className="d-flex align-items-center gap-3"
              onClick={(event) => event.stopPropagation()}
              onKeyDown={(event) => event.stopPropagation()}
            >
              {canMarkViewed ? (
                <div className="form-check mb-0">
                  <input
                    checked={viewed}
                    className="form-check-input"
                    disabled={savingFileViewKeys.includes(viewKey)}
                    id={`file-viewed-${viewKey}`}
                    type="checkbox"
                    onChange={() => void toggleFileViewed(commit, file.path)}
                  />
                  <label
                    className="form-check-label small"
                    htmlFor={`file-viewed-${viewKey}`}
                  >
                    {t("fileViewed")}
                  </label>
                </div>
              ) : null}
              <button
                className="btn btn-sm border-0 p-1"
                type="button"
                title={t("commentFile")}
                aria-label={t("commentFile")}
                onClick={() => toggleInlineComment(fileTarget)}
              >
                <i className="bi bi-chat-left-text" aria-hidden="true" />
              </button>
            </div>
          </div>
          {fileComposerOpen ? renderInlineCommentComposer() : null}
          {renderInlineCommentThreads(fileCommentThreads)}
          {fileExpanded ? (
          <div className="diff-viewer">
            {rows.map((row) => {
              if (row.kind === "hunk") {
                return (
                  <div className="diff-line-block" key={row.key}>
                    <div className="diff-hunk-header">{row.text}</div>
                  </div>
                );
              }

              const lineKind = diffLineClass(row.text);
              const lineTarget = row.lineNumber === null
                ? null
                : {
                    commitHash: commit.hash,
                    filePath: file.path,
                    lineNumber: row.lineNumber,
                    side: row.side,
                  } satisfies CommentTarget;
              const lineCommentThreads = lineTarget
                ? commentThreadsForTarget(lineTarget)
                : [];
              const inlineComposerOpen =
                !!lineTarget &&
                !!inlineCommentTarget &&
                targetKey(inlineCommentTarget) === targetKey(lineTarget);

              return (
                <div
                  className="diff-line-block"
                  id={lineTarget ? diffAnchorId(lineTarget) : undefined}
                  key={row.key}
                >
                  <div className={`diff-line ${lineKind}`}>
                    {lineTarget ? (
                      <button
                        className="diff-comment-button"
                        type="button"
                        title={t("commentLine")}
                        onClick={() => toggleInlineComment(lineTarget)}
                      >
                        <i className="bi bi-plus" aria-hidden="true" />
                      </button>
                    ) : (
                      <span className="diff-comment-button-placeholder" />
                    )}
                    {lineTarget ? (
                      <button
                        className="diff-line-number diff-line-number-link"
                        type="button"
                        title={t("lineLink")}
                        onClick={() => openDiffLocation(lineTarget)}
                      >
                        {row.lineNumber ?? ""}
                      </button>
                    ) : (
                      <span className="diff-line-number">
                        {row.lineNumber ?? ""}
                      </span>
                    )}
                    <code
                      className="diff-line-code hljs"
                      dangerouslySetInnerHTML={highlightedCode(row.text, language)}
                    />
                  </div>
                  {inlineComposerOpen ? renderInlineCommentComposer() : null}
                  {renderInlineCommentThreads(lineCommentThreads)}
                </div>
              );
            })}
          </div>
          ) : null}
        </div>
      );
    });
  };

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
  const reviewerActionSplit = (options: {
    menuOpen: boolean;
    setMenuOpen: (open: boolean) => void;
    saving: boolean;
    canAck: boolean;
    canReviewDone: boolean;
    preferReviewDone: boolean;
    ackLabel: string;
    onAck: () => void;
    onReviewDone: () => void;
    small?: boolean;
  }) => {
    const reviewDoneAction = options.canReviewDone
      ? {
          label: t("reviewDone"),
          icon: "bi-clipboard-check",
          onClick: options.onReviewDone,
        }
      : null;
    const ackAction = options.canAck
      ? {
          label: options.ackLabel,
          icon: "bi-check2-circle",
          onClick: options.onAck,
        }
      : null;
    const primary =
      options.preferReviewDone && reviewDoneAction
        ? reviewDoneAction
        : (ackAction ?? reviewDoneAction);
    if (!primary) {
      return null;
    }
    const secondaryActions = [reviewDoneAction, ackAction].filter(
      (action): action is NonNullable<typeof action> =>
        !!action && action !== primary,
    );
    const sizeClass = options.small ? " btn-sm" : "";

    return (
      <div className="btn-group review-action-group flex-shrink-0">
        <button
          className={`btn btn-success${sizeClass} d-inline-flex align-items-center gap-2`}
          disabled={options.saving}
          type="button"
          onClick={() => {
            options.setMenuOpen(false);
            primary.onClick();
          }}
        >
          {options.saving ? (
            <span className="spinner-border spinner-border-sm" />
          ) : (
            <i className={`bi ${primary.icon}`} aria-hidden="true" />
          )}
          {primary.label}
        </button>
        {secondaryActions.length ? (
          <>
            <button
              aria-expanded={options.menuOpen}
              className={`btn btn-success${sizeClass} dropdown-toggle dropdown-toggle-split`}
              disabled={options.saving}
              type="button"
              onClick={() => options.setMenuOpen(!options.menuOpen)}
            >
              <span className="visually-hidden">{t("moreActions")}</span>
            </button>
            <ul
              className={`dropdown-menu dropdown-menu-end review-action-menu${
                options.menuOpen ? " show" : ""
              }`}
            >
              {secondaryActions.map((action) => (
                <li key={action.label}>
                  <button
                    className="dropdown-item d-flex align-items-center gap-2"
                    type="button"
                    onClick={() => {
                      options.setMenuOpen(false);
                      action.onClick();
                    }}
                  >
                    <i className={`bi ${action.icon}`} aria-hidden="true" />
                    {action.label}
                  </button>
                </li>
              ))}
            </ul>
          </>
        ) : null}
      </div>
    );
  };
  const commitAckControls = (commit: ReviewCommit) => (
    <>
      {commit.acks.length ? (
        <span
          className="badge review-meta-badge flex-shrink-0"
          title={commit.acks
            .map((ack) => renderUserLabel(ack.user))
            .join(", ")}
        >
          <i className="bi bi-check2-circle me-1" aria-hidden="true" />
          {commit.acks.length}
        </span>
      ) : null}
      {currentReviewer &&
      review.status !== "CLOSED" &&
      commit.status !== "ACKED" &&
      !commitAckedByMe(commit)
        ? reviewerActionSplit({
            menuOpen: commitActionMenuOpenId === commit.id,
            setMenuOpen: (open) =>
              setCommitActionMenuOpenId(open ? commit.id : null),
            saving: savingCommitAckIds.includes(commit.id),
            canAck: canAckCommit(commit),
            canReviewDone: canMarkCommitReviewed(commit),
            preferReviewDone: openCommentCountForCommit(commit.hash) > 0,
            ackLabel: t("ackCommit"),
            onAck: () => void acknowledgeCommit(commit),
            onReviewDone: () => void markCommitReviewed(commit),
            small: true,
          })
        : null}
    </>
  );
  const totalDiffFileCount = review.commits.length
    ? review.commits.reduce(
        (sum, commit) => sum + commitDiffFiles(commit).length,
        0,
      )
    : review.gitDiff.files.length;

  return (
    <div className="review-page">
      <div className="d-flex flex-wrap align-items-center justify-content-end gap-3 mb-3">
        <div className="d-flex flex-wrap gap-2">
          <a
            className="btn btn-outline-primary"
            href={review.gitwebUrl}
            rel="noreferrer"
            target="_blank"
          >
            <i className="bi bi-box-arrow-up-right me-1" aria-hidden="true" />
          </a>
          {currentReviewer &&
          review.status !== "CLOSED" &&
          review.commits.some((commit) => !commitAckedByMe(commit))
            ? reviewerActionSplit({
                menuOpen: reviewActionMenuOpen,
                setMenuOpen: setReviewActionMenuOpen,
                saving: savingReviewAck,
                canAck: canAckReview,
                canReviewDone: canMarkReviewReviewed,
                preferReviewDone: openCommentCount > 0,
                ackLabel: t("ackReview"),
                onAck: () => void acknowledgeReview(),
                onReviewDone: () => void markReviewReviewed(),
              })
            : null}
          {review.ownerId === currentUser?.id && review.status !== "CLOSED" ? (
            <button
              className="btn btn-outline-secondary d-inline-flex align-items-center gap-2"
              type="button"
              disabled={loadingSyncPreview || syncingReview}
              onClick={() => void openSyncModal()}
            >
              {loadingSyncPreview || syncingReview ? (
                <span className="spinner-border spinner-border-sm" />
              ) : (
                <i className="bi bi-arrow-repeat" aria-hidden="true" />
              )}
              {t("syncReview")}
            </button>
          ) : null}
          {review.ownerId === currentUser?.id && review.status !== "CLOSED" ? (
            <span
              className="disabled-button-tooltip"
              title={
                !canCloseReview || savingCloseReview
                  ? closeReviewDisabledReason
                  : undefined
              }
            >
              <button
                className="btn btn-success d-inline-flex align-items-center gap-2"
                type="button"
                disabled={!canCloseReview || savingCloseReview}
                onClick={() => void closeReview()}
              >
                {savingCloseReview ? (
                  <span className="spinner-border spinner-border-sm" />
                ) : (
                  <i className="bi bi-check2-all" aria-hidden="true" />
                )}
                {t("closeReview")}
              </button>
            </span>
          ) : null}
          {canDeleteReview ? (
            <button
              className="btn btn-outline-danger d-inline-flex align-items-center gap-2"
              type="button"
              disabled={deletingReview}
              onClick={() => void deleteReview()}
            >
              {deletingReview ? (
                <span className="spinner-border spinner-border-sm" />
              ) : (
                <i className="bi bi-trash" aria-hidden="true" />
              )}
              {t("deleteReview")}
            </button>
          ) : null}
        </div>
      </div>

      {errorMessage ? (
        <div className="alert alert-danger">{errorMessage}</div>
      ) : null}

      <div className="card card-info card-outline review-workbench">
        <div className="card-header border-bottom-0">
          <div className="d-flex flex-wrap align-items-start justify-content-between gap-3">
            <div>
              <h3 className="card-title review-header-title">
                {reviewTitle(review)}
              </h3>
              <div className="text-secondary small">
                {t("openedBy")} {renderUserLabel(review.owner)} -{" "}
                {new Date(review.updatedAt).toLocaleString()}
              </div>
            </div>
            <div className="d-flex align-items-center gap-2">
              {loadingReview ? (
                <span className="spinner-border spinner-border-sm text-info" />
              ) : null}
              {review.commits.length > 1 ? (
                <span className="badge review-meta-badge">
                  {ackedCommitCount}/{review.commits.length}{" "}
                  {t("commitsAckedProgress")}
                </span>
              ) : null}
              <span
                className="badge review-meta-badge"
                title={t("reviewVersion")}
              >
                v{review.version}
              </span>
              <span className={`badge ${reviewStatusBadgeClass(review.status)}`}>
                {reviewStatusLabel(review.status)}
              </span>
            </div>
          </div>
        </div>
        <div className="card-header p-0 border-bottom">
          <ul className="nav nav-tabs card-header-tabs px-3 pt-2">
            <li className="nav-item">
              <button
                className={
                  activeReviewTab === "overview"
                    ? "nav-link active"
                    : "nav-link"
                }
                type="button"
                onClick={() => setActiveReviewTab("overview")}
              >
                <i className="bi bi-info-circle me-1" aria-hidden="true" />
                {t("overview")}
              </button>
            </li>
            <li className="nav-item">
              <button
                className={
                  activeReviewTab === "files" ? "nav-link active" : "nav-link"
                }
                type="button"
                onClick={() => setActiveReviewTab("files")}
              >
                <i className="bi bi-file-diff me-1" aria-hidden="true" />
                {t("filesChanged")}
                <span className="badge text-bg-secondary ms-2">
                  {totalDiffFileCount}
                </span>
              </button>
            </li>
            <li className="nav-item">
              <button
                className={
                  activeReviewTab === "comments"
                    ? "nav-link active"
                    : "nav-link"
                }
                type="button"
                onClick={() => setActiveReviewTab("comments")}
              >
                <i className="bi bi-chat-square-text me-1" aria-hidden="true" />
                {t("discussion")}
                <span className="badge text-bg-secondary ms-2">
                  {reviewCommentThreads.length}
                </span>
              </button>
            </li>
          </ul>
        </div>

        {activeReviewTab === "overview" ? (
          <div className="card-body">
            <div className="row g-4">
              <div className="col-lg-7">
                <dl className="review-description-summary mb-0 small">
                  <dt>{t("reviewTitle")}</dt>
                  <dd className="review-readonly-value text-break">
                    {reviewTitle(review)}
                  </dd>
                  <dt>{t("description")}</dt>
                  <dd className="review-readonly-value">
                    {(() => {
                      const collapsedDescription = reviewDescription(review);
                      const expandedDescription = fullReviewDescription(review);
                      const canExpand = expandedDescription.length > 220;
                      const visibleDescription = descriptionExpanded
                        ? expandedDescription
                        : canExpand
                          ? collapsedDescription.slice(0, 220).trimEnd()
                          : collapsedDescription;

                      return (
                        <div
                          className={
                            descriptionExpanded
                              ? "review-description is-expanded"
                              : "review-description"
                          }
                        >
                          {visibleDescription
                            ? linkedCommitLog(visibleDescription, review)
                            : t("notAvailable")}
                          {canExpand ? (
                            <button
                              className="description-ellipsis-button"
                              type="button"
                              aria-label={descriptionExpanded ? t("collapseDescription") : t("expandDescription")}
                              title={descriptionExpanded ? t("collapseDescription") : t("expandDescription")}
                              onClick={() => setDescriptionExpanded((current) => !current)}
                            >
                              <i
                                className={
                                  descriptionExpanded
                                    ? "bi bi-chevron-up"
                                    : "bi bi-chevron-down"
                                }
                                aria-hidden="true"
                              />
                            </button>
                          ) : null}
                        </div>
                      );
                    })()}
                  </dd>
                </dl>
                <div className="commit-summary-grid mt-3 mb-3">
                    <div className="commit-summary-item commit-summary-project">
                      <span className="commit-summary-icon">
                        <i className="bi bi-box" aria-hidden="true" />
                      </span>
                      <span className="commit-summary-label">
                        {t("sourceProject")}
                      </span>
                      <span className="commit-summary-value text-break">
                        {review.sourceProject || t("notAvailable")}
                      </span>
                    </div>
                    <div className="commit-summary-item commit-summary-branch">
                      <span className="commit-summary-icon">
                        <i className="bi bi-diagram-3" aria-hidden="true" />
                      </span>
                      <span className="commit-summary-label">
                        {t("sourceBranch")}
                      </span>
                      <span className="commit-summary-value text-break">
                        {sourceBranchLabel(review)}
                      </span>
                    </div>
                    <div className="commit-summary-item commit-summary-hash">
                      <span className="commit-summary-icon">
                        <i className="bi bi-git" aria-hidden="true" />
                      </span>
                      <span className="commit-summary-label">
                        {t("sourceCommit")}
                      </span>
                      <span className="commit-summary-value font-monospace text-break">
                        {shortHash(review.sourceCommit) || t("notAvailable")}
                      </span>
                    </div>
                    <div className="commit-summary-item commit-summary-fetch">
                      <span className="commit-summary-icon">
                        <i className="bi bi-clock-history" aria-hidden="true" />
                      </span>
                      <span className="commit-summary-label">
                        {t("gitwebFetchedAt")}
                      </span>
                      <span className="commit-summary-value">
                        {review.gitwebFetchedAt
                          ? new Date(review.gitwebFetchedAt).toLocaleString()
                          : t("notAvailable")}
                      </span>
                    </div>
                </div>
                <dl className="row mb-0 small">
                  <dt className="col-4">{t("gitwebUrl")}</dt>
                  <dd className="col-8 text-break">
                    <a
                      href={review.gitwebUrl}
                      rel="noreferrer"
                      target="_blank"
                    >
                      {review.gitwebUrl}
                    </a>
                  </dd>
                  {review.gitwebFetchError ? (
                    <>
                      <dt className="col-4">{t("gitwebFetchError")}</dt>
                      <dd className="col-8 text-danger text-break">
                        {gitwebFetchErrorLabel(review.gitwebFetchError, t)}
                      </dd>
                    </>
                  ) : null}
                  <dt className="col-4">{t("updatedAt")}</dt>
                  <dd className="col-8">
                    {new Date(review.updatedAt).toLocaleString()}
                  </dd>
                </dl>
              </div>
              <div className="col-lg-5">
                <div className="mb-3">
                  <span className="form-label d-block">{t("owner")}</span>
                  <span className="badge text-bg-secondary">
                    {renderUserLabel(review.owner)}
                  </span>
                </div>
                <div className="mb-3">
                  <ReviewerSearchSelect
                    disabled={!canEditReviewDetails}
                    excludeUserIds={[review.ownerId]}
                    idToken={idToken}
                    label={t("reviewers")}
                    selectedUserIds={reviewerUserIds}
                    selectedUsers={review.reviewers.map(
                      (reviewer) => reviewer.user,
                    )}
                    onChange={setReviewerUserIds}
                  />
                </div>
                {reviewFieldDefs.length ? (
                  <div className="mb-3">
                    <span className="form-label d-block">
                      {t("reviewFields")}
                    </span>
                    {reviewFieldDefs.map((field) => {
                      const draft = fieldValueDrafts[field.id] ?? "";
                      const saved = savedFieldValue(field.id);
                      const changed = draft.trim() !== saved;
                      const saving = savingFieldIds.includes(field.id);

                      return (
                        <div className="mb-2" key={field.id}>
                          <label
                            className="form-label small mb-1"
                            htmlFor={`review-field-${field.id}`}
                          >
                            {field.name}
                          </label>
                          <div className="input-group input-group-sm">
                            <input
                              className="form-control"
                              id={`review-field-${field.id}`}
                              disabled={!canEditReviewDetails}
                              placeholder={fieldPlaceholder(field.type)}
                              type={
                                field.type === "NUMBER"
                                  ? "number"
                                  : field.type === "TEXT"
                                    ? "text"
                                    : "url"
                              }
                              value={draft}
                              onChange={(event) =>
                                setFieldValueDrafts((current) => ({
                                  ...current,
                                  [field.id]: event.target.value,
                                }))
                              }
                            />
                            {canEditReviewDetails && changed ? (
                              <button
                                className="btn btn-outline-success d-inline-flex align-items-center gap-1"
                                type="button"
                                disabled={saving}
                                onClick={() => void saveFieldValue(field.id)}
                              >
                                {saving ? (
                                  <span className="spinner-border spinner-border-sm" />
                                ) : (
                                  <i className="bi bi-save" aria-hidden="true" />
                                )}
                                {t("save")}
                              </button>
                            ) : null}
                          </div>
                          {saved && field.type === "LINK" ? (
                            <a
                              className="small text-break d-inline-flex align-items-center gap-1 mt-1"
                              href={saved}
                              rel="noreferrer"
                              target="_blank"
                            >
                              <i
                                className="bi bi-box-arrow-up-right"
                                aria-hidden="true"
                              />
                              {saved}
                            </a>
                          ) : null}
                          {saved && field.type === "IMAGE" ? (
                            <a
                              className="d-block mt-1"
                              href={saved}
                              rel="noreferrer"
                              target="_blank"
                            >
                              <img
                                alt={field.name}
                                className="review-field-image"
                                src={saved}
                              />
                            </a>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                ) : null}
              </div>
            </div>
            {hasReviewChanges && canEditReviewDetails ? (
              <div className="d-flex gap-2 mt-4">
                <button
                  className="btn btn-success d-inline-flex align-items-center gap-2"
                  disabled={savingReview}
                  onClick={() => void saveReview()}
                >
                  {savingReview ? (
                    <span className="spinner-border spinner-border-sm" />
                  ) : null}
                  {t("saveReview")}
                </button>
              </div>
            ) : null}
            <div className="mt-4">
              <div className="d-flex align-items-center justify-content-between gap-3 mb-2">
                <h5 className="mb-0">
                  <i className="bi bi-chat-left-text me-2" aria-hidden="true" />
                  {t("reviewComments")}
                </h5>
                <button
                  className="btn btn-outline-secondary btn-sm d-inline-flex align-items-center gap-2"
                  type="button"
                  onClick={() => toggleInlineComment(generalCommentTarget)}
                >
                  <i className="bi bi-plus-lg" aria-hidden="true" />
                  {t("commentReview")}
                </button>
              </div>
              {inlineCommentTarget &&
              targetKey(inlineCommentTarget) === targetKey(generalCommentTarget)
                ? renderInlineCommentComposer()
                : null}
              {generalCommentThreads.length ? (
                renderInlineCommentThreads(generalCommentThreads)
              ) : (
                <div className="empty-state border rounded">
                  {t("noComments")}
                </div>
              )}
            </div>
          </div>
        ) : null}

        {activeReviewTab === "files" ? (
          <div className="card-body review-files-pane">
            {activeCommitHasComments ? (
              <button
                className="btn btn-primary next-comment-button d-inline-flex align-items-center gap-2"
                title={t("nextComment")}
                type="button"
                onClick={scrollToNextComment}
              >
                <i className="bi bi-chat-left-text" aria-hidden="true" />
                <i className="bi bi-arrow-down" aria-hidden="true" />
                <span className="visually-hidden">{t("nextComment")}</span>
              </button>
            ) : null}
            {review.commits.length ? (
              <>
                {review.commits.length > 1 ? (
                  <div className="review-commit-nav d-flex align-items-center gap-2 mb-3">
                    <div className="dropdown position-relative flex-grow-1 min-w-0">
                      <button
                        aria-expanded={commitNavOpen}
                        className="btn btn-outline-secondary w-100 d-flex align-items-center gap-2 review-commit-nav-toggle"
                        type="button"
                        onClick={() => setCommitNavOpen((current) => !current)}
                      >
                        <span className="badge review-meta-badge flex-shrink-0">
                          {activeCommitIndex + 1}/{review.commits.length}
                        </span>
                        <span className="font-monospace small flex-shrink-0">
                          {activeCommit?.hash.slice(0, 12)}
                        </span>
                        <span className="text-truncate flex-grow-1 text-start">
                          {activeCommit?.title}
                        </span>
                        {activeCommit ? commitChangeKindBadge(activeCommit) : null}
                        {activeCommit ? (
                          <span
                            className={`badge ${reviewCommitStatusBadgeClass(activeCommit.status)} flex-shrink-0`}
                          >
                            {t(`commitStatus${activeCommit.status}`)}
                          </span>
                        ) : null}
                        <i
                          className={`bi ${commitNavOpen ? "bi-chevron-up" : "bi-chevron-down"} flex-shrink-0`}
                          aria-hidden="true"
                        />
                      </button>
                      {commitNavOpen ? (
                        <div className="dropdown-menu show w-100 review-commit-nav-menu">
                          {review.commits.map((commit, index) => (
                            <button
                              className={`dropdown-item d-flex align-items-center gap-2 review-commit-nav-item${
                                commit.id === activeCommit?.id ? " active" : ""
                              }`}
                              key={commit.id}
                              type="button"
                              onClick={() => {
                                setActiveCommitId(commit.id);
                                setCommitNavOpen(false);
                              }}
                            >
                              <span className="badge review-meta-badge flex-shrink-0">
                                {index + 1}/{review.commits.length}
                              </span>
                              <span className="font-monospace small flex-shrink-0">
                                {commit.hash.slice(0, 12)}
                              </span>
                              <span className="text-truncate flex-grow-1 text-start">
                                {commit.title}
                              </span>
                              {commitChangeKindBadge(commit)}
                              {commitAckedByMe(commit) ? (
                                <i
                                  className="bi bi-check2-circle text-success flex-shrink-0"
                                  aria-hidden="true"
                                  title={t("commitAcked")}
                                />
                              ) : null}
                              <span
                                className={`badge ${reviewCommitStatusBadgeClass(commit.status)} flex-shrink-0`}
                              >
                                {t(`commitStatus${commit.status}`)}
                              </span>
                            </button>
                          ))}
                        </div>
                      ) : null}
                    </div>
                    {activeCommit ? commitAckControls(activeCommit) : null}
                  </div>
                ) : null}
                {activeCommit ? (
                  <>
                    <div className="card mb-3">
                      {review.commits.length === 1 ? (
                        <div className="card-header d-flex flex-wrap align-items-center justify-content-between gap-3">
                          <div className="d-flex flex-wrap align-items-center gap-2">
                            <span className="fw-semibold text-break">
                              {activeCommit.title}
                            </span>
                            <span className="font-monospace small text-secondary">
                              {activeCommit.hash.slice(0, 12)}
                            </span>
                            <span
                              className={`badge ${reviewCommitStatusBadgeClass(activeCommit.status)}`}
                            >
                              {t(`commitStatus${activeCommit.status}`)}
                            </span>
                          </div>
                          <div className="d-flex flex-wrap align-items-center gap-2">
                            {commitAckControls(activeCommit)}
                          </div>
                        </div>
                      ) : null}
                      {activeCommit.rawMessage && commitLogTarget ? (
                        <details
                          className="review-log-card"
                          id={diffAnchorId(commitLogTarget)}
                          open
                        >
                          <summary className="card-header fw-semibold">
                            <span className="d-flex align-items-center justify-content-between gap-3">
                              <span className="d-inline-flex align-items-center gap-2">
                                {t("gitwebLog")}
                                <i
                                  className="bi bi-chevron-down review-log-chevron"
                                  aria-hidden="true"
                                />
                              </span>
                              <button
                                className="btn btn-sm border-0 p-1"
                                type="button"
                                title={t("commentCommitLog")}
                                aria-label={t("commentCommitLog")}
                                onClick={(event) => {
                                  event.preventDefault();
                                  event.stopPropagation();
                                  toggleInlineComment(commitLogTarget);
                                }}
                              >
                                <i
                                  className="bi bi-chat-left-text"
                                  aria-hidden="true"
                                />
                              </button>
                            </span>
                          </summary>
                          <pre className="card-body mb-0 review-log-body">
                            {linkedCommitLog(activeCommit.rawMessage, review)}
                          </pre>
                          {inlineCommentTarget &&
                          targetKey(inlineCommentTarget) ===
                            targetKey(commitLogTarget)
                            ? renderInlineCommentComposer()
                            : null}
                          {renderInlineCommentThreads(
                            commentThreadsForTarget(commitLogTarget),
                          )}
                        </details>
                      ) : null}
                    </div>
                    {renderGitDiff(activeCommit, commitDiffFiles(activeCommit))}
                  </>
                ) : null}
              </>
            ) : (
              <div className="empty-state border rounded">
                {t("diffNotAvailable")}
              </div>
            )}
          </div>
        ) : null}

        {activeReviewTab === "comments" ? (
          <div className="card-body">
            {reviewCommentThreads.length ? (
              <div className="timeline timeline-inverse mb-0">
                {reviewCommentThreads.map((thread) => (
                  <div className="time-label" key={thread.commentId}>
                    <span className="review-meta-badge">
                      {new Date(thread.createdAt).toLocaleString()}
                    </span>
                    <div className={`card mt-2 review-comment-card${thread.done ? " is-done" : ""}`}>
                      <div
                        aria-expanded={isDiscussionExpanded(thread)}
                        className="card-header d-flex justify-content-between gap-3 comment-thread-header"
                        role="button"
                        tabIndex={0}
                        onClick={() => toggleDiscussionExpanded(thread)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault();
                            toggleDiscussionExpanded(thread);
                          }
                        }}
                      >
                        <span className="fw-semibold">
                          {renderUserLabel(thread.messages[0].author)}
                        </span>
                        <div className="d-flex flex-wrap align-items-center gap-2">
                          {threadDiffAvailable(thread) ? (
                            <button
                              className="btn btn-outline-primary btn-sm"
                              type="button"
                              onClick={(event) => {
                                event.stopPropagation();
                                openDiffForThread(thread);
                              }}
                            >
                              <i
                                className="bi bi-file-diff me-1"
                                aria-hidden="true"
                              />
                              {t("viewDiff")}
                            </button>
                          ) : null}
                          {renderCommentThreadControls(thread, true)}
                        </div>
                      </div>
                      <div className="card-body review-comment-body">
                        {isDiscussionExpanded(thread) ? (
                          <>
                            {renderCommentMessages(thread)}
                            {thread.done && thread.doneAt ? (
                              <div className="comment-done-meta mt-2">
                                {t("commentDoneBy")} {thread.doneBy ? renderUserLabel(thread.doneBy) : t("notAvailable")} - {new Date(thread.doneAt).toLocaleString()}
                              </div>
                            ) : null}
                            {renderCommentReplyForm(thread)}
                          </>
                        ) : (
                          <div className="markdown-body">
                            {renderMarkdown(thread.messages[0].message)}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="empty-state border rounded">
                {t("noComments")}
              </div>
            )}
          </div>
        ) : null}
      </div>

      {syncModalOpen ? (
        <>
          <div className="modal d-block" role="dialog" aria-modal="true">
            <div className="modal-dialog modal-lg">
              <div className="modal-content">
                <div className="modal-header">
                  <div>
                    <h5 className="modal-title">{t("syncReviewTitle")}</h5>
                    {syncPreview?.sourceBranch ? (
                      <div className="small text-secondary text-break">
                        {syncPreview.sourceBranch}
                      </div>
                    ) : null}
                  </div>
                  <button
                    className="btn-close"
                    type="button"
                    aria-label="Close"
                    onClick={closeSyncModal}
                  />
                </div>
                <div className="modal-body">
                  {loadingSyncPreview ? (
                    <div className="d-flex align-items-center gap-2 text-secondary">
                      <span className="spinner-border spinner-border-sm" />
                      {t("loadingSyncPreview")}
                    </div>
                  ) : null}
                  {syncPreview && !syncPreview.hasChanges ? (
                    <div className="alert alert-info mb-0">
                      {t("syncNoChanges")}
                    </div>
                  ) : null}
                  {syncPreview?.hasChanges ? (
                    <>
                      <p className="text-secondary small mb-3">
                        {t("syncCreatesVersion")}{" "}
                        <span className="badge review-meta-badge">
                          v{syncPreview.version + 1}
                        </span>
                      </p>
                      <div className="list-group mb-3">
                        {syncPreview.commits.map((commit) => (
                          <label
                            className="list-group-item d-flex align-items-center gap-2"
                            key={commit.hash}
                          >
                            <input
                              checked={syncCommitHashes.includes(commit.hash)}
                              className="form-check-input flex-shrink-0 mt-0"
                              type="checkbox"
                              onChange={() => toggleSyncCommit(commit.hash)}
                            />
                            <span className="font-monospace small flex-shrink-0">
                              {commit.hash.slice(0, 12)}
                            </span>
                            <span className="text-truncate flex-grow-1">
                              {commit.title}
                            </span>
                            <span
                              className={`badge ${changeKindBadgeClass(commit.changeKind)} flex-shrink-0`}
                            >
                              {t(`changeKind${commit.changeKind}`)}
                            </span>
                          </label>
                        ))}
                      </div>
                      {syncPreview.droppedCommits.length ? (
                        <>
                          <span className="form-label d-block">
                            {t("syncDroppedCommits")}
                          </span>
                          <div className="list-group">
                            {syncPreview.droppedCommits.map((commit) => (
                              <div
                                className="list-group-item d-flex align-items-center gap-2 text-secondary"
                                key={commit.hash}
                              >
                                <i
                                  className="bi bi-x-circle flex-shrink-0"
                                  aria-hidden="true"
                                />
                                <span className="font-monospace small flex-shrink-0">
                                  {commit.hash.slice(0, 12)}
                                </span>
                                <span className="text-truncate flex-grow-1 text-decoration-line-through">
                                  {commit.title}
                                </span>
                              </div>
                            ))}
                          </div>
                        </>
                      ) : null}
                    </>
                  ) : null}
                </div>
                <div className="modal-footer">
                  <button
                    className="btn btn-outline-secondary"
                    type="button"
                    onClick={closeSyncModal}
                  >
                    {t("cancel")}
                  </button>
                  <button
                    className="btn btn-primary d-inline-flex align-items-center gap-2"
                    type="button"
                    disabled={
                      !syncPreview?.hasChanges ||
                      syncCommitHashes.length === 0 ||
                      syncingReview
                    }
                    onClick={() => void applySync()}
                  >
                    {syncingReview ? (
                      <span className="spinner-border spinner-border-sm" />
                    ) : (
                      <i className="bi bi-arrow-repeat" aria-hidden="true" />
                    )}
                    {t("syncApply")}
                    {syncPreview ? ` v${syncPreview.version + 1}` : null}
                  </button>
                </div>
              </div>
            </div>
          </div>
          <div className="modal-backdrop show" />
        </>
      ) : null}
    </div>
  );
}
