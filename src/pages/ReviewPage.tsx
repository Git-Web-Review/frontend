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

const REVIEW_STATUSES: ReviewStatus[] = [
  "PENDING",
  "IN_REVIEW",
  "APPROVED",
  "CHANGES_REQUESTED",
];

const REVIEW_STATUS_BADGE_CLASSES: Record<ReviewStatus, string> = {
  PENDING: "text-bg-secondary",
  IN_REVIEW: "text-bg-info",
  APPROVED: "text-bg-success",
  CHANGES_REQUESTED: "text-bg-warning",
  CLOSED: "text-bg-dark",
};

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
  h: "c",
  hpp: "cpp",
  html: "xml",
  js: "javascript",
  json: "json",
  jsx: "javascript",
  md: "markdown",
  patch: "diff",
  py: "python",
  sh: "bash",
  ts: "typescript",
  tsx: "typescript",
  xml: "xml",
  yaml: "yaml",
  yml: "yaml",
};

const languageAliases: Record<string, string> = {
  docker: "dockerfile",
  htm: "xml",
  html: "xml",
  js: "javascript",
  jsx: "javascript",
  md: "markdown",
  patch: "diff",
  py: "python",
  shell: "bash",
  sh: "bash",
  ts: "typescript",
  tsx: "typescript",
  yml: "yaml",
  zsh: "bash",
};

const normalizeLanguage = (language: string | null | undefined) => {
  if (!language) {
    return null;
  }

  const normalized = language.toLowerCase();
  return languageAliases[normalized] ?? normalized;
};

const languageFromClassName = (className: string | undefined) => {
  const match = /(?:^|\s)language-([^\s]+)/.exec(className ?? "");
  return normalizeLanguage(match?.[1]);
};

const languageForPath = (filePath: string) => {
  const fileName = filePath.split("/").at(-1) ?? filePath;
  const extension = fileName.includes(".") ? fileName.split(".").at(-1) : null;

  if (fileName === "Dockerfile" || fileName.endsWith(".dockerfile")) {
    return "dockerfile";
  }

  return extension ? languageByExtension[extension.toLowerCase()] : null;
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

const stringFromPayload = (
  payload: Record<string, unknown>,
  key: string,
) => (typeof payload[key] === "string" ? payload[key] : null);

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
  const [title, setTitle] = useState("");
  const [status, setStatus] = useState<ReviewStatus>("PENDING");
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
      setTitle(nextReview.title ?? "");
      setStatus(nextReview.status);
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

  const nullableText = (value: string) => {
    const trimmed = value.trim();
    return trimmed ? trimmed : null;
  };

  const sortedReviewerUserIds = (userIds: string[]) => [...userIds].sort();

  const canEditReview =
    !!review &&
    (review.ownerId === currentUser?.id || currentUser?.role === "ADMIN");
  const canEditReviewDetails = !!review && review.ownerId === currentUser?.id;
  const canUpdateReviewStatus =
    !!review &&
    review.status !== "CLOSED" &&
    review.reviewers.some((reviewer) => reviewer.userId === currentUser?.id);
  const canUpdateCommentDone =
    !!review &&
    (review.ownerId === currentUser?.id ||
      review.reviewers.some((reviewer) => reviewer.userId === currentUser?.id));
  const currentReviewer = review?.reviewers.find(
    (reviewer) => reviewer.userId === currentUser?.id,
  );
  const openCommentCount = reviewComments.filter((comment) => !comment.done).length;
  const canAckReview =
    !!currentReviewer &&
    !currentReviewer.acknowledgedAt &&
    !loadingReviewComments &&
    openCommentCount === 0;
  const reviewAcknowledged =
    !!review &&
    review.reviewers.length > 0 &&
    review.reviewers.some((reviewer) => !!reviewer.acknowledgedAt);
  const canCloseReview =
    !!review &&
    review.ownerId === currentUser?.id &&
    review.status !== "CLOSED" &&
    reviewAcknowledged;
  const hasReviewChanges =
    !!review &&
    ((canEditReviewDetails &&
      (title !== (review.title ?? "") ||
        sortedReviewerUserIds(reviewerUserIds).join("\n") !==
          sortedReviewerUserIds(
            review.reviewers.map((reviewer) => reviewer.userId),
          ).join("\n"))) ||
      (canUpdateReviewStatus && status !== review.status));

  const reviewStatusLabel = (reviewStatus: ReviewStatus) =>
    t(`reviewStatus${reviewStatus}`);

  const reviewStatusBadgeClass = (reviewStatus: ReviewStatus) =>
    REVIEW_STATUS_BADGE_CLASSES[reviewStatus];

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
            title: nullableText(title),
            reviewerUserIds,
          }
        : {}),
      ...(canUpdateReviewStatus ? { status } : {}),
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
    if (!idToken || !review || !canEditReview) {
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
      setStatus(nextReview.status);
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

  const commentsForTarget = (target: CommentTarget) =>
    reviewComments.filter((comment) => targetKey(comment) === targetKey(target));

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

  const updateCommentDone = async (comment: ReviewComment, done: boolean) => {
    if (!idToken || !review || !canUpdateCommentDone) {
      return;
    }

    setSavingDoneCommentIds((current) => [...current, comment.commentId]);
    setErrorMessage("");
    try {
      const comments = await apiRequest<ReviewComment[]>(
        `/v1/reviews/${review.id}/comments/${comment.commentId}`,
        idToken,
        {
          method: "PATCH",
          body: JSON.stringify({ done }),
        },
      );
      replaceCommentThread(comments);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : t("backendError"),
      );
    } finally {
      setSavingDoneCommentIds((current) =>
        current.filter((commentId) => commentId !== comment.commentId),
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
        HOSTNAME: url.hostname.replace(/\.dev\.6wind\.com$/, ""),
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
      const lines = file.patch.split("\n");
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
            {lines.map((line, index) => {
              const lineNumber = index + 1;
              const lineKind = diffLineClass(line);
              const lineTarget = {
                commitHash: currentReview.sourceCommit,
                filePath: file.path,
                lineNumber,
              } satisfies CommentTarget;
              const lineComments = commentsForTarget(lineTarget);
              const inlineComposerOpen =
                !!inlineCommentTarget &&
                targetKey(inlineCommentTarget) === targetKey(lineTarget);

              return (
                <div className="diff-line-block" key={`${file.path}-${lineNumber}`}>
                  <div className={`diff-line ${lineKind}`}>
                    <button
                      className="diff-comment-button"
                      type="button"
                      title={t("commentLine")}
                      onClick={() => toggleInlineComment(lineTarget)}
                    >
                      <i className="bi bi-plus" aria-hidden="true" />
                    </button>
                    <span className="diff-line-number">{lineNumber}</span>
                    <code
                      className="diff-line-code hljs"
                      dangerouslySetInnerHTML={highlightedCode(line, language)}
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
                  {lineComments.length ? (
                    <div className="diff-inline-comments">
                      {lineComments.map((comment) => (
                        <div
                          className={`diff-inline-comment${comment.done ? " is-done" : ""}`}
                          key={comment.id}
                        >
                          <div className="diff-inline-comment-meta">
                            <span className="fw-semibold">
                              {renderUserLabel(comment.author)}
                            </span>
                            <span>{new Date(comment.createdAt).toLocaleString()}</span>
                            {comment.done ? (
                              <span className="badge text-bg-success">
                                {t("commentDone")}
                              </span>
                            ) : null}
                            {canUpdateCommentDone ? (
                              <button
                                className={`btn btn-sm ${comment.done ? "btn-outline-secondary" : "btn-outline-success"}`}
                                disabled={savingDoneCommentIds.includes(
                                  comment.commentId,
                                )}
                                type="button"
                                onClick={() =>
                                  void updateCommentDone(comment, !comment.done)
                                }
                              >
                                {comment.done
                                  ? t("reopenComment")
                                  : t("markCommentDone")}
                              </button>
                            ) : null}
                          </div>
                          <div className="markdown-body">
                            {renderMarkdown(comment.message)}
                          </div>
                          {comment.done && comment.doneAt ? (
                            <div className="comment-done-meta">
                              {t("commentDoneBy")} {comment.doneBy ? renderUserLabel(comment.doneBy) : t("notAvailable")} - {new Date(comment.doneAt).toLocaleString()}
                            </div>
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
            <button
              className="btn btn-success d-inline-flex align-items-center gap-2"
              disabled={!canAckReview || savingReviewAck}
              title={
                loadingReviewComments || openCommentCount > 0
                  ? t("reviewAckRequiresDoneComments")
                  : undefined
              }
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
          ) : null}
          {review.ownerId === currentUser?.id && review.status !== "CLOSED" ? (
            <button
              className="btn btn-success d-inline-flex align-items-center gap-2"
              type="button"
              disabled={!canCloseReview || savingCloseReview}
              title={!canCloseReview ? t("closeReviewRequiresAck") : undefined}
              onClick={() => void closeReview()}
            >
              {savingCloseReview ? (
                <span className="spinner-border spinner-border-sm" />
              ) : (
                <i className="bi bi-check2-all" aria-hidden="true" />
              )}
              {t("closeReview")}
            </button>
          ) : null}
          {canEditReview ? (
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
              {currentReviewer?.acknowledgedAt ? (
                <span className="badge text-bg-success">
                  {t("reviewAcknowledged")}
                </span>
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
                  {reviewComments.length}
                </span>
              </button>
            </li>
          </ul>
        </div>

        {activeReviewTab === "overview" ? (
          <div className="card-body">
            <div className="row g-4">
              <div className="col-lg-7">
                <div className="mb-3">
                  <label className="form-label" htmlFor="review-title">
                    {t("reviewTitle")}
                  </label>
                  <input
                    className="form-control"
                    disabled={!canEditReviewDetails}
                    id="review-title"
                    value={title}
                    onChange={(event) => setTitle(event.target.value)}
                  />
                </div>
                <div className="row g-3">
                  <div className="col-md-6">
                    <label className="form-label" htmlFor="review-status">
                      {t("reviewState")}
                    </label>
                    <select
                      className="form-select"
                      disabled={!canUpdateReviewStatus}
                      id="review-status"
                      value={status}
                      onChange={(event) =>
                        setStatus(event.target.value as ReviewStatus)
                      }
                    >
                      {review.status === "CLOSED" ? (
                        <option value="CLOSED">{reviewStatusLabel("CLOSED")}</option>
                      ) : null}
                      {REVIEW_STATUSES.map((reviewStatus) => (
                        <option key={reviewStatus} value={reviewStatus}>
                          {reviewStatusLabel(reviewStatus)}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                {reviewDescription(review) ? (
                  <dl className="review-description-summary mb-0 mt-3 small">
                    <dt>{t("description")}</dt>
                    {(() => {
                      const description = reviewDescription(review);
                      const canExpand = description.length > 220;
                      const visibleDescription =
                        canExpand && !descriptionExpanded
                          ? description.slice(0, 220).trimEnd()
                          : description;

                      return (
                        <dd className={descriptionExpanded ? "review-description is-expanded" : "review-description"}>
                          {visibleDescription}
                          {canExpand ? (
                            <button
                              className="description-ellipsis-button"
                              type="button"
                              aria-label={descriptionExpanded ? t("collapseDescription") : t("expandDescription")}
                              title={descriptionExpanded ? t("collapseDescription") : t("expandDescription")}
                              onClick={() => setDescriptionExpanded((current) => !current)}
                            >
                              {descriptionExpanded ? t("collapseDescription") : "..."}
                            </button>
                          ) : null}
                        </dd>
                      );
                    })()}
                  </dl>
                ) : null}
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
            {hasReviewChanges && (canEditReviewDetails || canUpdateReviewStatus) ? (
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
              <details className="card mb-3 review-log-card">
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
            {reviewComments.length ? (
              <div className="timeline timeline-inverse mb-0">
                {reviewComments.map((comment) => (
                  <div className="time-label" key={comment.id}>
                    <span className="text-bg-light">
                      {new Date(comment.createdAt).toLocaleString()}
                    </span>
                    <div className={`card mt-2 review-comment-card${comment.done ? " is-done" : ""}`}>
                      <div className="card-header d-flex justify-content-between gap-3">
                        <span className="fw-semibold">
                          {renderUserLabel(comment.author)}
                        </span>
                        <div className="d-flex flex-wrap align-items-center gap-2">
                          {comment.done ? (
                            <span className="badge text-bg-success">
                              {t("commentDone")}
                            </span>
                          ) : null}
                          <span className="badge text-bg-secondary">
                            {commentTargetLabel(comment)}
                          </span>
                          {canUpdateCommentDone ? (
                            <button
                              className={`btn btn-sm ${comment.done ? "btn-outline-secondary" : "btn-outline-success"}`}
                              disabled={savingDoneCommentIds.includes(
                                comment.commentId,
                              )}
                              type="button"
                              onClick={() =>
                                void updateCommentDone(comment, !comment.done)
                              }
                            >
                              {comment.done
                                ? t("reopenComment")
                                : t("markCommentDone")}
                            </button>
                          ) : null}
                        </div>
                      </div>
                      <div className="card-body review-comment-body">
                        <div className="markdown-body">
                          {renderMarkdown(comment.message)}
                        </div>
                        {comment.done && comment.doneAt ? (
                          <div className="comment-done-meta mt-2">
                            {t("commentDoneBy")} {comment.doneBy ? renderUserLabel(comment.doneBy) : t("notAvailable")} - {new Date(comment.doneAt).toLocaleString()}
                          </div>
                        ) : null}
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
    </div>
  );
}
