import { type ReactNode, useEffect, useState } from "react";
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
  ReviewDeletion,
  ReviewItem,
  ReviewStatus,
  ReviewUserSummary,
} from "../types/api";
import { reviewStatusBadgeClass } from "../utils/reviewStatus";

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
      };
    }

    if (line.startsWith("+") && !line.startsWith("+++")) {
      const lineNumber = newLineNumber;
      newLineNumber += 1;
      return { kind: "line", key: `line-${index}`, text: line, lineNumber };
    }

    if (line.startsWith("-") && !line.startsWith("---")) {
      const lineNumber = oldLineNumber;
      oldLineNumber += 1;
      return { kind: "line", key: `line-${index}`, text: line, lineNumber };
    }

    if (line.startsWith(" ")) {
      const lineNumber = newLineNumber;
      oldLineNumber += 1;
      newLineNumber += 1;
      return { kind: "line", key: `line-${index}`, text: line, lineNumber };
    }

    return {
      kind: "line",
      key: `metadata-${index}`,
      text: line,
      lineNumber: null,
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
  lineNumber: number;
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

type CommitLogMatch = {
  key: string;
  label: string;
  text: string;
  href: string;
  index: number;
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
  const [commentTarget, setCommentTarget] = useState<CommentTarget>({
    commitHash: null,
    filePath: null,
    lineNumber: 1,
  });
  const [commentDraft, setCommentDraft] = useState("");
  const [inlineCommentTarget, setInlineCommentTarget] =
    useState<CommentTarget | null>(null);
  const [inlineCommentDraft, setInlineCommentDraft] = useState("");
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
  const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({});
  const [savingReplyCommentIds, setSavingReplyCommentIds] = useState<string[]>(
    [],
  );
  const [savingReviewAck, setSavingReviewAck] = useState(false);
  const [descriptionExpanded, setDescriptionExpanded] = useState(false);

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

  useEffect(() => {
    void loadReview();
    void loadCommitLogLinkRules();
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
  const openCommentCount = new Set(
    reviewComments
      .filter((comment) => !comment.done)
      .map((comment) => comment.commentId),
  ).size;
  const canAckReview =
    !!currentReviewer &&
    !currentReviewer.acknowledgedAt &&
    !loadingReviewComments &&
    openCommentCount === 0;
  const canCloseReview =
    !!review &&
    review.ownerId === currentUser?.id &&
    review.status === "ACKED";
  const ackReviewDisabledReason = savingReviewAck
    ? t("actionInProgress")
    : loadingReviewComments || openCommentCount > 0
      ? t("reviewAckRequiresDoneComments")
      : undefined;
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
    if (!target.filePath) {
      return t("generalReviewComment");
    }

    return `${target.filePath}:${target.lineNumber}`;
  };

  const startLineComment = (target: CommentTarget) => {
    setCommentTarget(target);
    setActiveReviewTab("comments");
  };

  const targetKey = (target: CommentTarget) =>
    `${target.commitHash ?? ""}:${target.filePath ?? ""}:${target.lineNumber}`;

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
      setInlineCommentDraft("");
      return;
    }

    setInlineCommentTarget(target);
    setInlineCommentDraft("");
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

  const addInlineComment = async () => {
    const message = inlineCommentDraft.trim();
    if (!inlineCommentTarget || !message) {
      return;
    }

    setSavingComment(true);
    setErrorMessage("");
    try {
      const comment = await createReviewComment(inlineCommentTarget, message);
      if (comment) {
        setReviewComments((current) => [...current, comment]);
        setInlineCommentDraft("");
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

  const addComment = async () => {
    const message = commentDraft.trim();
    if (!message) {
      return;
    }

    setSavingComment(true);
    setErrorMessage("");
    try {
      const comment = await createReviewComment(commentTarget, message);
      if (comment) {
        setReviewComments((current) => [...current, comment]);
        setCommentDraft("");
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
                    className="btn btn-outline-secondary btn-sm"
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
                    className="btn btn-outline-danger btn-sm"
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
        <span className="badge text-bg-light border">
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
            className={`btn btn-sm ${thread.done ? "btn-outline-secondary" : "btn-outline-success"}`}
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
    const code = codeFromDiffLine(line);
    const normalizedLanguage = normalizeLanguage(language);
    if (!normalizedLanguage || !hljs.getLanguage(normalizedLanguage)) {
      return { __html: hljs.highlightAuto(code).value || " " };
    }

    return { __html: hljs.highlight(code, { language: normalizedLanguage }).value || " " };
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

  const commitLogMatches = (currentReview: ReviewItem): CommitLogMatch[] => {
    const text = currentReview.gitwebLog ?? "";
    const templateVariables = gitwebTemplateVariables(currentReview);
    const matches: CommitLogMatch[] = [];
    const seenMatches = new Set<string>();

    for (const rule of commitLogLinkRules) {
      if (!rule.enabled) {
        continue;
      }

      try {
        const regex = new RegExp(rule.regex, "g");
        let match: RegExpExecArray | null;
        while ((match = regex.exec(text))) {
          if (match[0].length === 0) {
            regex.lastIndex += 1;
            continue;
          }

          const href = hrefFromRule(rule, match, templateVariables);
          const key = `${rule.id}:${match.index}:${match[0]}:${href}`;
          if (seenMatches.has(key)) {
            continue;
          }

          seenMatches.add(key);
          matches.push({
            key,
            label: rule.label || t("commitLogMatch"),
            text: match[0],
            href,
            index: match.index,
          });
        }
      } catch {
        continue;
      }
    }

    return matches.sort((left, right) => left.index - right.index);
  };

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

  const renderGitDiff = (currentReview: ReviewItem) => {
    if (currentReview.gitDiff.files.length === 0) {
      return (
        <div className="empty-state border rounded">
          {t("diffNotAvailable")}
        </div>
      );
    }

    return currentReview.gitDiff.files.map((file) => {
      const rows = diffRenderRows(file.patch);
      const language = languageForPath(file.path);

      return (
        <div className="card mb-3" key={file.path}>
          <div className="card-header d-flex align-items-center justify-content-between gap-3">
            <div>
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
            <button
              className="btn btn-outline-secondary btn-sm"
              type="button"
              onClick={() =>
                toggleInlineComment({
                  commitHash: currentReview.sourceCommit,
                  filePath: file.path,
                  lineNumber: 1,
                })
              }
            >
              <i className="bi bi-chat-left-text me-1" aria-hidden="true" />
              {t("commentFile")}
            </button>
          </div>
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
                    commitHash: currentReview.sourceCommit,
                    filePath: file.path,
                    lineNumber: row.lineNumber,
                  } satisfies CommentTarget;
              const lineCommentThreads = lineTarget
                ? commentThreadsForTarget(lineTarget)
                : [];
              const inlineComposerOpen =
                !!lineTarget &&
                !!inlineCommentTarget &&
                targetKey(inlineCommentTarget) === targetKey(lineTarget);

              return (
                <div className="diff-line-block" key={row.key}>
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
                    <span className="diff-line-number">
                      {row.lineNumber ?? ""}
                    </span>
                    <code
                      className="diff-line-code hljs"
                      dangerouslySetInnerHTML={highlightedCode(row.text, language)}
                    />
                  </div>
                  {inlineComposerOpen ? (
                    <div className="diff-inline-comment-panel">
                      <div className="diff-inline-comment-editor">
                        <textarea
                          className="form-control"
                          rows={4}
                          value={inlineCommentDraft}
                          onChange={(event) =>
                            setInlineCommentDraft(event.target.value)
                          }
                          placeholder={t("markdownCommentPlaceholder")}
                        />
                        <div className="diff-inline-comment-actions">
                          <button
                            className="btn btn-outline-secondary btn-sm"
                            type="button"
                            onClick={() => {
                              setInlineCommentTarget(null);
                              setInlineCommentDraft("");
                            }}
                          >
                            {t("cancel")}
                          </button>
                          <button
                            className="btn btn-primary btn-sm"
                            type="button"
                            disabled={!inlineCommentDraft.trim() || savingComment}
                            onClick={() => void addInlineComment()}
                          >
                            {t("addComment")}
                          </button>
                        </div>
                      </div>
                      <div className="diff-inline-comment-preview markdown-body">
                        {inlineCommentDraft.trim()
                          ? renderMarkdown(inlineCommentDraft)
                          : t("markdownPreviewEmpty")}
                      </div>
                    </div>
                  ) : null}
                  {lineCommentThreads.length ? (
                    <div className="diff-inline-comments">
                      {lineCommentThreads.map((thread) => (
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
                  ) : null}
                </div>
              );
            })}
          </div>
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

  const overviewCommitLogMatches = commitLogMatches(review);
  const reviewCommentThreads = commentThreadsFrom(reviewComments);

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
          {currentReviewer && !currentReviewer.acknowledgedAt ? (
            <span
              className="disabled-button-tooltip"
              title={
                !canAckReview || savingReviewAck
                  ? ackReviewDisabledReason
                  : undefined
              }
            >
              <button
                className="btn btn-success d-inline-flex align-items-center gap-2"
                disabled={!canAckReview || savingReviewAck}
                type="button"
                onClick={() => void acknowledgeReview()}
              >
                {savingReviewAck ? (
                  <span className="spinner-border spinner-border-sm" />
                ) : (
                  <i className="bi bi-check2-circle" aria-hidden="true" />
                )}
                {t("ackReview")}
              </button>
            </span>
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
                  {review.gitDiff.files.length}
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
                          {visibleDescription || t("notAvailable")}
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
                {overviewCommitLogMatches.length ? (
                  <div className="commit-log-match-panel mb-3">
                    <div className="commit-log-match-title">
                      <i className="bi bi-stars" aria-hidden="true" />
                      {t("commitLogMatches")}
                    </div>
                    <div className="commit-log-match-list">
                      {overviewCommitLogMatches.map((match) => (
                        <a
                          className="commit-log-match-chip"
                          href={match.href}
                          key={match.key}
                          rel="noreferrer"
                          target="_blank"
                        >
                          <span className="commit-log-match-label">
                            {match.label}
                          </span>
                          <span className="commit-log-match-value">
                            {match.text}
                          </span>
                          <i className="bi bi-box-arrow-up-right" aria-hidden="true" />
                        </a>
                      ))}
                    </div>
                  </div>
                ) : null}
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
                        {review.gitwebFetchError}
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
          </div>
        ) : null}

        {activeReviewTab === "files" ? (
          <div className="card-body review-files-pane">
            {review.gitwebLog ? (
              <details className="card mb-3 review-log-card" open>
                <summary className="card-header fw-semibold">
                  {t("gitwebLog")}
                </summary>
                <pre className="card-body mb-0 review-log-body">
                  {linkedCommitLog(review.gitwebLog, review)}
                </pre>
              </details>
            ) : null}
            {renderGitDiff(review)}
          </div>
        ) : null}

        {activeReviewTab === "comments" ? (
          <div className="card-body">
            <div className="card mb-3">
              <div className="card-header">
                <span className="fw-semibold">{t("newComment")}</span>
                <span className="badge text-bg-secondary ms-2">
                  {commentTargetLabel(commentTarget)}
                </span>
              </div>
              <div className="card-body">
                <textarea
                  className="form-control"
                  rows={4}
                  value={commentDraft}
                  onChange={(event) => setCommentDraft(event.target.value)}
                  placeholder={t("commentPlaceholder")}
                />
                <div className="d-flex justify-content-between align-items-center mt-3">
                  <button
                    className="btn btn-outline-secondary"
                    type="button"
                    onClick={() =>
                      setCommentTarget({
                        commitHash: null,
                        filePath: null,
                        lineNumber: 1,
                      })
                    }
                  >
                    {t("generalReviewComment")}
                  </button>
                  <button
                    className="btn btn-primary"
                    disabled={!commentDraft.trim() || savingComment}
                    type="button"
                    onClick={() => void addComment()}
                  >
                    {t("addComment")}
                  </button>
                </div>
              </div>
            </div>
            {reviewCommentThreads.length ? (
              <div className="timeline timeline-inverse mb-0">
                {reviewCommentThreads.map((thread) => (
                  <div className="time-label" key={thread.commentId}>
                    <span className="text-bg-light">
                      {new Date(thread.createdAt).toLocaleString()}
                    </span>
                    <div className={`card mt-2 review-comment-card${thread.done ? " is-done" : ""}`}>
                      <div
                        aria-expanded={isCommentThreadExpanded(thread)}
                        className="card-header d-flex justify-content-between gap-3 comment-thread-header"
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
                        <div className="d-flex flex-wrap align-items-center gap-2">
                          {renderCommentThreadControls(thread, true)}
                        </div>
                      </div>
                      {isCommentThreadExpanded(thread) ? (
                        <div className="card-body review-comment-body">
                          {renderCommentMessages(thread)}
                          {thread.done && thread.doneAt ? (
                            <div className="comment-done-meta mt-2">
                              {t("commentDoneBy")} {thread.doneBy ? renderUserLabel(thread.doneBy) : t("notAvailable")} - {new Date(thread.doneAt).toLocaleString()}
                            </div>
                          ) : null}
                          {renderCommentReplyForm(thread)}
                        </div>
                      ) : null}
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
    </div>
  );
}
