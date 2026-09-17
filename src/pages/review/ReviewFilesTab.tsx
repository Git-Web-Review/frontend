import type { Dispatch, SetStateAction } from "react";
import type {
  CommitLogLinkRule,
  ReviewComment,
  ReviewItem,
} from "../../types/api";
import {
  commentThreadsForTarget,
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
import type { ReviewPermissions } from "./review-permissions";

/** The Files tab, wired to the page state it reads and changes. */
export function ReviewFilesTab({
  review,
  reviewComments,
  currentUserId,
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
  currentUserId: string | undefined;
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
  const activeCommit =
    review.commits.find(
      (commit) => commit.id === diffNavigation.activeCommitId,
    ) ??
    review.commits[0] ??
    null;

  return (
    <FilesTabPanel
      review={review}
      currentUserId={currentUserId}
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
      onSelectCommit={(commitId) => {
        diffNavigation.setActiveCommitId(commitId);
        setCommitNavOpen(false);
      }}
      onScrollToNextComment={scrollToNextComment}
      commitLogLinkRules={commitLogLinkRules}
      inlineCommentTarget={inline.inlineCommentTarget}
      targetKey={targetKey}
      commentThreadsForTarget={(target) =>
        commentThreadsForTarget(reviewComments, target)
      }
      // Comment threads hidden while a file card is collapsed, file-level
      // and line-level alike, so the header badge keeps them visible.
      fileCommentCount={(commitHash, filePath) =>
        threadCount(
          reviewComments.filter(
            (comment) =>
              comment.commitHash === commitHash &&
              comment.filePath === filePath,
          ),
        )
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
