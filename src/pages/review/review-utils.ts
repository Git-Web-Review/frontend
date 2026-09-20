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
    case "LOG_MODIFIED":
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

export const threadRootMessage = (thread: ReviewCommentThread) =>
  thread.messages[0];

/** Every message after the root one — what the reply rail renders. */
export const threadReplies = (thread: ReviewCommentThread) =>
  thread.messages.slice(1);

export const threadLastMessage = (thread: ReviewCommentThread) =>
  thread.messages[thread.messages.length - 1];

/** Distinct authors, in the order they joined the conversation. */
export const threadParticipants = (thread: ReviewCommentThread) => {
  const seen = new Set<string>();

  return thread.messages
    .map((comment) => comment.author)
    .filter((author) => {
      if (seen.has(author.id)) {
        return false;
      }
      seen.add(author.id);
      return true;
    });
};

/**
 * Replies posted by someone else since `lastSeenAt` — drives the "new
 * replies" banner inside an expanded thread.
 */
export const threadNewReplyCount = (
  thread: ReviewCommentThread,
  lastSeenAt: string | null,
  currentUserId: string | undefined,
) => {
  if (!lastSeenAt) {
    return 0;
  }

  const since = new Date(lastSeenAt).getTime();

  return threadReplies(thread).filter(
    (reply) =>
      reply.author.id !== currentUserId &&
      new Date(reply.createdAt).getTime() > since,
  ).length;
};

export type DiscussionFilter = "open" | "done" | "all";

export type DiscussionSort = "recent" | "oldest";

export const filteredCommentThreads = (
  threads: ReviewCommentThread[],
  filter: DiscussionFilter,
) => {
  if (filter === "all") {
    return threads;
  }

  return threads.filter((thread) =>
    filter === "done" ? thread.done : !thread.done,
  );
};

/** Sorted on the last message, so a revived conversation comes back up. */
export const sortedCommentThreads = (
  threads: ReviewCommentThread[],
  sort: DiscussionSort,
) =>
  [...threads].sort((left, right) => {
    const leftTime = new Date(threadLastMessage(left).createdAt).getTime();
    const rightTime = new Date(threadLastMessage(right).createdAt).getTime();
    return sort === "recent" ? rightTime - leftTime : leftTime - rightTime;
  });

export type ReviewCommentThreadGroup = {
  key: string;
  filePath: string | null;
  threads: ReviewCommentThread[];
};

/** One group per file, general comments last. */
export const commentThreadGroups = (
  threads: ReviewCommentThread[],
): ReviewCommentThreadGroup[] => {
  const groups = new Map<string, ReviewCommentThreadGroup>();

  for (const thread of threads) {
    const key = thread.filePath ?? "";
    const group = groups.get(key);
    if (group) {
      group.threads.push(thread);
      continue;
    }

    groups.set(key, {
      key,
      filePath: thread.filePath,
      threads: [thread],
    });
  }

  return [...groups.values()].sort((left, right) => {
    if (left.filePath === right.filePath) {
      return 0;
    }
    if (left.filePath === null) {
      return 1;
    }
    if (right.filePath === null) {
      return -1;
    }
    return left.filePath.localeCompare(right.filePath);
  });
};

/** Basename plus line, the compact form of `commentTargetLabel`. */
export const threadChipLabel = (thread: ReviewCommentThread) => {
  if (thread.filePath) {
    const basename = thread.filePath.split("/").pop() || thread.filePath;
    return thread.lineNumber === null
      ? basename
      : `${basename}:${thread.lineNumber}`;
  }

  return thread.commitHash ? thread.commitHash.slice(0, 12) : null;
};
