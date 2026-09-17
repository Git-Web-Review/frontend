import { useEffect, useState, type MutableRefObject } from "react";
import { useBlocker } from "react-router-dom";
import { useI18n } from "../../../i18n/I18nProvider";
import type { ReviewComment } from "../../../types/api";
import {
  clearCommentDrafts,
  writeCommentDrafts,
  type CommentDrafts,
} from "../comment-drafts";
import { commentTargetLabel, targetKey } from "../comment-threads";
import type { Translate } from "../review-display";
import type { UnpostedCommentDraft } from "../UnpostedCommentsModal";
import type { CommentActions } from "./useCommentActions";
import type { InlineComment } from "./useInlineComment";

type DraftSources = {
  inline: InlineComment;
  comments: CommentActions;
  reviewComments: ReviewComment[];
};

const editedCommentOf = ({ comments, reviewComments }: DraftSources) =>
  reviewComments.find((comment) => comment.id === comments.editingCommentId);

/** Everything typed and not posted yet. */
const collectUnpostedDrafts = (
  sources: DraftSources,
  t: Translate,
): UnpostedCommentDraft[] => {
  const { inline, comments, reviewComments } = sources;
  const drafts: UnpostedCommentDraft[] = [];
  for (const [key, draft] of Object.entries(inline.newCommentDrafts)) {
    if (draft.message.trim()) {
      drafts.push({
        key: `comment:${key}`,
        kind: "comment",
        targetLabel: commentTargetLabel(draft.target, t),
        message: draft.message,
      });
    }
  }
  const editedComment = editedCommentOf(sources);
  if (
    editedComment &&
    comments.editCommentDraft.trim() &&
    comments.editCommentDraft.trim() !== editedComment.message.trim()
  ) {
    drafts.push({
      key: `edit:${editedComment.id}`,
      kind: "edit",
      targetLabel: commentTargetLabel(editedComment, t),
      message: comments.editCommentDraft,
    });
  }
  for (const [commentId, message] of Object.entries(comments.replyDrafts)) {
    if (!message.trim()) {
      continue;
    }
    const threadComment = reviewComments.find(
      (comment) => comment.commentId === commentId,
    );
    drafts.push({
      key: `reply:${commentId}`,
      kind: "reply",
      targetLabel: threadComment ? commentTargetLabel(threadComment, t) : "",
      message,
    });
  }
  return drafts;
};

/**
 * What is kept in the browser, never in the backend. Until the comments
 * load, an edit cannot be told apart from an untouched message, so it is
 * kept.
 */
const draftsToStore = (sources: DraftSources): CommentDrafts => {
  const { inline, comments } = sources;
  const editDraft = comments.editCommentDraft;
  const stored: CommentDrafts = {
    newComments: Object.fromEntries(
      Object.entries(inline.newCommentDrafts).filter(([, draft]) =>
        draft.message.trim(),
      ),
    ),
    openTargetKey: null,
    replies: Object.fromEntries(
      Object.entries(comments.replyDrafts).filter(([, message]) =>
        message.trim(),
      ),
    ),
    edit:
      comments.editingCommentId &&
      editDraft.trim() &&
      editDraft.trim() !== editedCommentOf(sources)?.message.trim()
        ? { messageId: comments.editingCommentId, message: editDraft }
        : null,
  };
  if (
    inline.inlineCommentTarget &&
    targetKey(inline.inlineCommentTarget) in stored.newComments
  ) {
    stored.openTargetKey = targetKey(inline.inlineCommentTarget);
  }
  return stored;
};

/**
 * Stores the unposted comments on every change, and guards leaving the
 * page when the browser refused to store them.
 */
export function useUnpostedDrafts({
  draftOwnerId,
  reviewId,
  skipGuardRef,
  ...sources
}: DraftSources & {
  draftOwnerId: string;
  reviewId: string;
  /** Set right before a navigation that must not ask about them. */
  skipGuardRef: MutableRefObject<boolean>;
}) {
  const { t } = useI18n();
  const [draftStorageFailed, setDraftStorageFailed] = useState(false);
  const unpostedDrafts = collectUnpostedDrafts(sources, t);
  const stored = draftsToStore(sources);
  const serializedDrafts = JSON.stringify(stored);

  useEffect(() => {
    setDraftStorageFailed(!writeCommentDrafts(draftOwnerId, reviewId, stored));
  }, [draftOwnerId, reviewId, serializedDrafts]);

  // Stored drafts come back on the next visit, so leaving only loses them
  // when the browser refused to store them. Tabs and diff links only touch
  // the query string and never lose anything.
  const draftsAtRisk = draftStorageFailed && unpostedDrafts.length > 0;
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      draftsAtRisk &&
      !skipGuardRef.current &&
      currentLocation.pathname !== nextLocation.pathname,
  );

  useEffect(() => {
    if (!draftsAtRisk) {
      return;
    }

    // Reloading or closing the tab only allows the browser's own prompt.
    const warnBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };
    window.addEventListener("beforeunload", warnBeforeUnload);
    return () => window.removeEventListener("beforeunload", warnBeforeUnload);
  }, [draftsAtRisk]);

  // An earlier write may have succeeded; leaving anyway must not bring that
  // older copy back on the next visit.
  const leaveWithoutPosting = () => {
    clearCommentDrafts(draftOwnerId, reviewId);
    blocker.proceed?.();
  };

  return {
    unpostedDrafts,
    blocked: blocker.state === "blocked",
    stay: () => blocker.reset?.(),
    leaveWithoutPosting,
  };
}
