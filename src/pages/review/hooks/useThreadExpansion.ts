import { useState } from "react";
import { toggleId } from "../../../utils/idList";
import type { ReviewCommentThread } from "../review-utils";

/**
 * Which threads are open. Open threads start expanded and resolved ones
 * folded, so each kind remembers the exceptions.
 */
export function useThreadExpansion() {
  const [expandedCommentIds, setExpandedCommentIds] = useState<string[]>([]);
  const [collapsedCommentIds, setCollapsedCommentIds] = useState<string[]>([]);
  const [expandedDiscussionIds, setExpandedDiscussionIds] = useState<string[]>(
    [],
  );
  const [expandedRepliesIds, setExpandedRepliesIds] = useState<string[]>([]);

  const isCommentThreadExpanded = (thread: ReviewCommentThread) =>
    thread.done
      ? expandedCommentIds.includes(thread.commentId)
      : !collapsedCommentIds.includes(thread.commentId);

  const toggleCommentThreadExpanded = (thread: ReviewCommentThread) => {
    if (thread.done) {
      setExpandedCommentIds((current) => toggleId(current, thread.commentId));
      return;
    }

    setCollapsedCommentIds((current) => toggleId(current, thread.commentId));
  };

  const isDiscussionExpanded = (thread: ReviewCommentThread) =>
    expandedDiscussionIds.includes(thread.commentId);

  const toggleDiscussionExpanded = (thread: ReviewCommentThread) => {
    setExpandedDiscussionIds((current) => toggleId(current, thread.commentId));
  };

  const expandAllDiscussions = (threads: ReviewCommentThread[]) =>
    setExpandedDiscussionIds(threads.map((thread) => thread.commentId));

  const collapseAllDiscussions = () => setExpandedDiscussionIds([]);

  const areRepliesExpanded = (thread: ReviewCommentThread) =>
    expandedRepliesIds.includes(thread.commentId);

  const toggleRepliesExpanded = (thread: ReviewCommentThread) => {
    setExpandedRepliesIds((current) => toggleId(current, thread.commentId));
  };

  return {
    isCommentThreadExpanded,
    toggleCommentThreadExpanded,
    isDiscussionExpanded,
    toggleDiscussionExpanded,
    expandAllDiscussions,
    collapseAllDiscussions,
    areRepliesExpanded,
    toggleRepliesExpanded,
  };
}

export type ThreadExpansion = ReturnType<typeof useThreadExpansion>;
