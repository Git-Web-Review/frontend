import type { RealtimeNotificationEvent } from "../../realtime/events";
import type {
  ReviewComment,
  ReviewCommentSide,
  ReviewCommitChangeKind,
  ReviewItem,
} from "../../types/api";

export const codeFromDiffLine = (line: string) => {
  if (
    (line.startsWith("+") && !line.startsWith("+++")) ||
    (line.startsWith("-") && !line.startsWith("---")) ||
    line.startsWith(" ")
  ) {
    return line.slice(1);
  }

  return line;
};

export type DiffRenderRow =
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

const diffIndexLinePattern = /^index ([0-9a-f]+)\.\.([0-9a-f]+)/m;

export const diffBlobHashes = (patch: string) => {
  const match = diffIndexLinePattern.exec(patch);
  const validHash = (hash: string | undefined) =>
    hash && !/^0+$/.test(hash) ? hash : null;
  return {
    oldHash: validHash(match?.[1]),
    newHash: validHash(match?.[2]),
  };
};

export type DiffBlobHashes = ReturnType<typeof diffBlobHashes>;

export const diffRenderRows = (patch: string): DiffRenderRow[] => {
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

export const stringFromPayload = (
  payload: Record<string, unknown>,
  key: string,
) => (typeof payload[key] === "string" ? payload[key] : null);

export const shortHostname = (hostname: string) =>
  hostname.split(".")[0] ?? hostname;

export const notificationMatchesReview = (
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

// Sync kinds carry the secondary label hue when the commit moved, neutral
// when it did not.
export const changeKindBadgeClass = (kind: ReviewCommitChangeKind) => {
  switch (kind) {
    case "NEW":
    case "MODIFIED":
    case "REBASED":
      return "text-bg-info";
    default:
      return "review-meta-badge";
  }
};

export type ReviewTab = "overview" | "files" | "comments";

export type CommentTarget = {
  commitHash: string | null;
  filePath: string | null;
  lineNumber: number | null;
  side: ReviewCommentSide;
};

export type ReviewCommentThread = CommentTarget & {
  commentId: string;
  reviewId: string;
  done: boolean;
  doneBy: ReviewComment["doneBy"];
  doneAt: string | null;
  createdAt: string;
  messages: ReviewComment[];
};
