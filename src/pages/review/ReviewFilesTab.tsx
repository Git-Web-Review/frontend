import { useEffect, useMemo, type Dispatch, type SetStateAction } from "react";
import type {
  CommitLogLinkRule,
  ReviewComment,
  ReviewItem,
} from "../../types/api";
import {
  commentThreadIndex,
  diffAnchorId,
  targetKey,
  threadCount,
} from "./comment-threads";
import { FilesTabPanel } from "./FilesTabPanel";
import type { useCommentRenderers } from "./hooks/useCommentRenderers";
import {
  scrollToNextComment,
  type useDiffNavigation,
} from "./hooks/useDiffNavigation";
import { fileViewKey, type useFileViews } from "./hooks/useFileViews";
import type { InlineComment } from "./hooks/useInlineComment";
import type { useReviewStatusActions } from "./hooks/useReviewStatusActions";
import { commitDiffFiles, userLabel } from "./review-display";
import type { PermissionUser, ReviewPermissions } from "./review-permissions";

/** The Files tab, wired to the page state it reads and changes. */
export function ReviewFilesTab({
  review,
  reviewComments,
  currentUser,
  commitLogLinkRules,
  permissions,
  statusActions,
  fileViews,
  diffNavigation,
  inline,
  renderers,
  commitNavOpen,
  setCommitNavOpen,
  commitActionMenuOpenId,
  setCommitActionMenuOpenId,
}: {
  review: ReviewItem;
  reviewComments: ReviewComment[];
  currentUser: PermissionUser;
  commitLogLinkRules: CommitLogLinkRule[];
  permissions: ReviewPermissions;
  statusActions: ReturnType<typeof useReviewStatusActions>;
  fileViews: ReturnType<typeof useFileViews>;
  diffNavigation: ReturnType<typeof useDiffNavigation>;
  inline: InlineComment;
  renderers: ReturnType<typeof useCommentRenderers>;
  commitNavOpen: boolean;
  setCommitNavOpen: Dispatch<SetStateAction<boolean>>;
  commitActionMenuOpenId: string | null;
  setCommitActionMenuOpenId: (commitId: string | null) => void;
}) {
  const threadsForTarget = useMemo(
    () => commentThreadIndex(reviewComments),
    [reviewComments],
  );
  // Thread ids per commit and file, for the collapsed file card badges.
  const fileThreadIds = useMemo(() => {
    const threadIds = new Map<string, Set<string>>();
    for (const comment of reviewComments) {
      const key = `${comment.commitHash ?? ""}:${comment.filePath ?? ""}`;
      const ids = threadIds.get(key) ?? new Set<string>();
      ids.add(comment.commentId);
      threadIds.set(key, ids);
    }
    return threadIds;
  }, [reviewComments]);
  const activeCommit =
    review.commits.find(
      (commit) => commit.id === diffNavigation.activeCommitId,
    ) ??
    review.commits[0] ??
    null;

  // Left/right arrows move to the previous/next commit, unless typing.
  const activeCommitId = activeCommit?.id;
  useEffect(() => {
    const moveOnArrow = (event: KeyboardEvent) => {
      if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
      if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey)
        return;
      const target = event.target as HTMLElement | null;
      if (target?.closest("input, textarea, select, [contenteditable]"))
        return;
      const index = review.commits.findIndex(
        (commit) => commit.id === activeCommitId,
      );
      const next =
        review.commits[index + (event.key === "ArrowRight" ? 1 : -1)];
      if (!next) return;
      event.preventDefault();
      diffNavigation.selectCommit(next.id);
    };
    window.addEventListener("keydown", moveOnArrow);
    return () => window.removeEventListener("keydown", moveOnArrow);
  }, [review.commits, activeCommitId, diffNavigation]);

  return (
    <FilesTabPanel
      review={review}
      currentUser={currentUser}
      isReviewer={!!permissions.currentReviewer}
      activeCommit={activeCommit}
      activeCommitIndex={
        activeCommit
          ? review.commits.findIndex((commit) => commit.id === activeCommit.id)
          : -1
      }
      activeCommitHasComments={
        !!activeCommit &&
        reviewComments.some(
          (comment) => comment.commitHash === activeCommit.hash,
        )
      }
      commitLogTarget={
        activeCommit
          ? {
              commitHash: activeCommit.hash,
              filePath: null,
              lineNumber: null,
              side: "AFTER",
            }
          : null
      }
      commitNavOpen={commitNavOpen}
      onToggleCommitNav={() => setCommitNavOpen((current) => !current)}
      onCloseCommitNav={() => setCommitNavOpen(false)}
      onSelectCommit={(commitId) => {
        diffNavigation.selectCommit(commitId);
        setCommitNavOpen(false);
      }}
      onScrollToNextComment={scrollToNextComment}
      commitLogLinkRules={commitLogLinkRules}
      inlineCommentTarget={inline.inlineCommentTarget}
      targetKey={targetKey}
      commentThreadsForTarget={threadsForTarget}
      // Comment threads hidden while a file card is collapsed, file-level
      // and line-level alike, so the header badge keeps them visible.
      fileCommentCount={(commitHash, filePath) =>
        fileThreadIds.get(`${commitHash}:${filePath}`)?.size ?? 0
      }
      toggleInlineComment={inline.toggleInlineComment}
      renderInlineCommentComposer={renderers.renderInlineCommentComposer}
      renderInlineCommentThreads={renderers.renderInlineCommentThreads}
      diffAnchorId={diffAnchorId}
      fileViewKey={fileViewKey}
      isFileViewedByMe={fileViews.isFileViewedByMe}
      expandedFileKeys={fileViews.expandedFileKeys}
      setExpandedFileKeys={fileViews.setExpandedFileKeys}
      savingFileViewKeys={fileViews.savingFileViewKeys}
      toggleFileViewed={(commit, filePath) =>
        void fileViews.toggleFileViewed(commit, filePath)
      }
      openDiffLocation={diffNavigation.openDiffLocation}
      commitDiffFiles={(commit) => commitDiffFiles(review, commit)}
      renderUserLabel={userLabel}
      commitAckedByMe={permissions.commitAckedByMe}
      savingCommitAckIds={statusActions.savingCommitAckIds}
      unacknowledgeCommit={(commit) =>
        void statusActions.unacknowledgeCommit(commit)
      }
      commitActionMenuOpenId={commitActionMenuOpenId}
      setCommitActionMenuOpenId={setCommitActionMenuOpenId}
      canAckCommit={permissions.canAckCommit}
      canMarkCommitReviewed={permissions.canMarkCommitReviewed}
      openCommentCountForCommit={(commitHash) =>
        threadCount(
          reviewComments.filter(
            (comment) => !comment.done && comment.commitHash === commitHash,
          ),
        )
      }
      acknowledgeCommit={(commit) =>
        void statusActions.acknowledgeCommit(commit)
      }
      markCommitReviewed={(commit) =>
        void statusActions.markCommitReviewed(commit)
      }
    />
  );
}
