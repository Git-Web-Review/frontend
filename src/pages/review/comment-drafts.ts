import type { CommentTarget } from "./review-utils";

/**
 * Comments started on a review and not posted yet. They are kept in this
 * browser only, never sent to the backend, so leaving or reloading the page
 * brings them back instead of losing them.
 */
export type CommentDrafts = {
  /** New threads, keyed like the page keys comment targets. */
  newComments: Record<string, { target: CommentTarget; message: string }>;
  /** The one whose composer was open. */
  openTargetKey: string | null;
  /** Replies, keyed by thread id. */
  replies: Record<string, string>;
  /** A posted message being rewritten. */
  edit: { messageId: string; message: string } | null;
};

const emptyCommentDrafts: CommentDrafts = {
  newComments: {},
  openTargetKey: null,
  replies: {},
  edit: null,
};

// Per user too: someone else signing in on this browser must not get them.
const storageKey = (userId: string, reviewId: string) =>
  `review-comment-drafts:${userId}:${reviewId}`;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

export const readCommentDrafts = (
  userId: string,
  reviewId: string,
): CommentDrafts => {
  try {
    const raw = localStorage.getItem(storageKey(userId, reviewId));
    const stored: unknown = raw ? JSON.parse(raw) : null;
    if (!isRecord(stored)) {
      return emptyCommentDrafts;
    }

    // Hand-edited or older entries: keep what still has the expected shape.
    const newComments = Object.fromEntries(
      Object.entries(isRecord(stored.newComments) ? stored.newComments : {})
        .filter(
          (entry): entry is [string, CommentDrafts["newComments"][string]] =>
            isRecord(entry[1]) &&
            isRecord(entry[1].target) &&
            typeof entry[1].message === "string",
        ),
    );
    const replies = Object.fromEntries(
      Object.entries(isRecord(stored.replies) ? stored.replies : {}).filter(
        (entry): entry is [string, string] => typeof entry[1] === "string",
      ),
    );
    const edit =
      isRecord(stored.edit) &&
      typeof stored.edit.messageId === "string" &&
      typeof stored.edit.message === "string"
        ? { messageId: stored.edit.messageId, message: stored.edit.message }
        : null;
    const openTargetKey =
      typeof stored.openTargetKey === "string" &&
      stored.openTargetKey in newComments
        ? stored.openTargetKey
        : null;

    return { newComments, openTargetKey, replies, edit };
  } catch {
    return emptyCommentDrafts;
  }
};

/** False when the browser refused to keep them (storage blocked or full). */
export const writeCommentDrafts = (
  userId: string,
  reviewId: string,
  drafts: CommentDrafts,
) => {
  const empty =
    !drafts.edit &&
    !Object.keys(drafts.newComments).length &&
    !Object.keys(drafts.replies).length;

  try {
    if (empty) {
      localStorage.removeItem(storageKey(userId, reviewId));
    } else {
      localStorage.setItem(
        storageKey(userId, reviewId),
        JSON.stringify(drafts),
      );
    }
    return true;
  } catch {
    return false;
  }
};

export const clearCommentDrafts = (userId: string, reviewId: string) =>
  writeCommentDrafts(userId, reviewId, emptyCommentDrafts);
