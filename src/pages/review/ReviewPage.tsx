import { useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useAuth } from "../../auth/AuthProvider";
import { useI18n } from "../../i18n/I18nProvider";
import { CommentsTabPanel } from "./CommentsTabPanel";
import { clearCommentDrafts, readCommentDrafts } from "./comment-drafts";
import {
  commentTargetLabel,
  commentThreadsForTarget,
  commentThreadsFrom,
  targetKey,
  threadCount,
} from "./comment-threads";
import { useCommentActions } from "./hooks/useCommentActions";
import { useCommentRenderers } from "./hooks/useCommentRenderers";
import { useDiffNavigation } from "./hooks/useDiffNavigation";
import { useFileViews } from "./hooks/useFileViews";
import { useInlineComment } from "./hooks/useInlineComment";
import { useLastSeenAt } from "./hooks/useLastSeenAt";
import { useReviewData } from "./hooks/useReviewData";
import {
  useReviewDetailsDrafts,
  useReviewDetailsForm,
} from "./hooks/useReviewDetailsForm";
import { useReviewStatusActions } from "./hooks/useReviewStatusActions";
import { useReviewSync } from "./hooks/useReviewSync";
import { useThreadExpansion } from "./hooks/useThreadExpansion";
import { useUnpostedDrafts } from "./hooks/useUnpostedDrafts";
import { MentionUsersProvider } from "./mentions";
import { OverviewTabPanel } from "./OverviewTabPanel";
import {
  fieldPlaceholder,
  fullReviewDescription,
  mentionableUsers,
  reviewDescription,
  reviewTitle,
  shortHash,
  sourceBranchLabel,
  totalDiffFileCount,
  userLabel,
} from "./review-display";
import { ReviewFilesTab } from "./ReviewFilesTab";
import { reviewPermissions } from "./review-permissions";
import type {
  CommentTarget,
  DiscussionFilter,
  DiscussionSort,
  ReviewCommentThread,
  ReviewTab,
} from "./review-utils";
import { ReviewHeader } from "./ReviewHeader";
import { SyncModal } from "./SyncModal";
import { UnpostedCommentsModal } from "./UnpostedCommentsModal";

const generalCommentTarget = {
  commitHash: null,
  filePath: null,
  lineNumber: null,
  side: "AFTER",
} satisfies CommentTarget;

export function ReviewPage() {
  const { reviewId = "" } = useParams<{ reviewId: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { currentUser, idToken } = useAuth();
  const { t } = useI18n();
  // <App> only routes here once signed in.
  const draftOwnerId = currentUser?.id ?? "";
  // Read once: the page is mounted afresh for each review.
  const [storedDrafts] = useState(() =>
    readCommentDrafts(draftOwnerId, reviewId),
  );
  // Set right before a navigation that must not ask about unposted comments.
  const skipUnpostedGuardRef = useRef(false);
  const activeReviewTab = (
    searchParams.get("tab") === "files" ||
    searchParams.get("tab") === "comments"
      ? searchParams.get("tab")
      : "overview"
  ) as ReviewTab;
  const [reviewActionMenuOpen, setReviewActionMenuOpen] = useState(false);
  const [commitActionMenuOpenId, setCommitActionMenuOpenId] = useState<
    string | null
  >(null);
  const [commitNavOpen, setCommitNavOpen] = useState(false);
  const [descriptionExpanded, setDescriptionExpanded] = useState(false);
  const [discussionFilter, setDiscussionFilter] =
    useState<DiscussionFilter>("open");
  const [discussionSort, setDiscussionSort] =
    useState<DiscussionSort>("recent");

  const drafts = useReviewDetailsDrafts();
  const data = useReviewData(reviewId, drafts.resetDrafts);
  const { review, reviewComments, loadingReview, errorMessage } = data;
  const permissions = reviewPermissions(review, currentUser?.id);
  const details = useReviewDetailsForm(data, drafts, permissions);
  const statusActions = useReviewStatusActions(
    data,
    permissions,
    (deletedReviewId) => {
      clearCommentDrafts(draftOwnerId, deletedReviewId);
      skipUnpostedGuardRef.current = true;
      navigate("/dashboard");
    },
  );
  const sync = useReviewSync(reviewId, async () => {
    await data.loadReview();
    await data.loadReviewComments();
  });
  const fileViews = useFileViews(data);
  const diffNavigation = useDiffNavigation({
    review,
    activeReviewTab,
    searchParams,
    setSearchParams,
    setExpandedFileKeys: fileViews.setExpandedFileKeys,
  });
  const lastSeenAt = useLastSeenAt(reviewId);
  const expansion = useThreadExpansion();
  const comments = useCommentActions(
    data,
    storedDrafts,
    permissions.canUpdateCommentDone,
  );
  const inline = useInlineComment(data, storedDrafts);
  const renderers = useCommentRenderers({
    review,
    comments,
    inline,
    expansion,
    canUpdateCommentDone: permissions.canUpdateCommentDone,
    lastSeenAt,
  });
  const unposted = useUnpostedDrafts({
    draftOwnerId,
    reviewId,
    skipGuardRef: skipUnpostedGuardRef,
    inline,
    comments,
    reviewComments,
  });

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

  const { currentReviewer } = permissions;
  const setActiveReviewTab = (tab: ReviewTab) => {
    setSearchParams(tab === "overview" ? {} : { tab });
  };
  const threadDiffAvailable = (thread: ReviewCommentThread) =>
    !!thread.commitHash &&
    review.commits.some((commit) => commit.hash === thread.commitHash);
  const openComments = reviewComments.filter((comment) => !comment.done);

  const reviewPageContent = (
    <div className="review-page">
      <ReviewHeader
        review={review}
        currentUserId={currentUser?.id}
        isReviewer={!!currentReviewer}
        title={reviewTitle(review)}
        ownerLabel={userLabel(review.owner)}
        statusLabel={t(`reviewStatus${review.status}`)}
        loadingReview={loadingReview}
        ackedCommitCount={
          review.commits.filter((commit) => commit.status === "ACKED").length
        }
        activeTab={activeReviewTab}
        onTabChange={setActiveReviewTab}
        totalDiffFileCount={totalDiffFileCount(review)}
        commentThreadCount={threadCount(reviewComments)}
        commitAckedByMe={permissions.commitAckedByMe}
        reviewActionMenuOpen={reviewActionMenuOpen}
        setReviewActionMenuOpen={setReviewActionMenuOpen}
        savingReviewAck={statusActions.savingReviewAck}
        canAckReview={permissions.canAckReview}
        canMarkReviewReviewed={permissions.canMarkReviewReviewed}
        openCommentCount={threadCount(openComments)}
        onAcknowledgeReview={() => void statusActions.acknowledgeReview()}
        onMarkReviewReviewed={() => void statusActions.markReviewReviewed()}
        onUnacknowledgeReview={() => void statusActions.unacknowledgeReview()}
        loadingSyncPreview={sync.loadingSyncPreview}
        syncingReview={sync.syncingReview}
        onOpenSyncModal={() => void sync.openSyncModal()}
        canCloseReview={permissions.canCloseReview}
        closeReviewDisabledReason={
          statusActions.savingCloseReview
            ? t("actionInProgress")
            : !permissions.canCloseReview
              ? t("closeReviewRequiresAck")
              : undefined
        }
        savingCloseReview={statusActions.savingCloseReview}
        onCloseReview={() => void statusActions.closeReview()}
        canDeleteReview={permissions.canDeleteReview}
        deletingReview={statusActions.deletingReview}
        onDeleteReview={() => void statusActions.deleteReview()}
      />

      {errorMessage ? (
        <div className="alert alert-danger">{errorMessage}</div>
      ) : null}

      <div className="card card-info card-outline review-workbench">
        {activeReviewTab === "overview" ? (
          <OverviewTabPanel
            review={review}
            idToken={idToken}
            canEditReviewDetails={permissions.canEditReviewDetails}
            canAddReviewers={permissions.canAddReviewers}
            titleDraft={drafts.titleDraft}
            onTitleDraftChange={drafts.setTitleDraft}
            descriptionDraft={drafts.descriptionDraft}
            onDescriptionDraftChange={drafts.setDescriptionDraft}
            reviewTitleText={reviewTitle(review)}
            collapsedDescription={reviewDescription(review)}
            fullDescription={fullReviewDescription(review)}
            descriptionExpanded={descriptionExpanded}
            onToggleDescriptionExpanded={() =>
              setDescriptionExpanded((current) => !current)
            }
            commitLogLinkRules={data.commitLogLinkRules}
            sourceBranchLabelText={sourceBranchLabel(review)}
            sourceCommitLabel={shortHash(review.sourceCommit)}
            renderUserLabel={userLabel}
            reviewerUserIds={drafts.reviewerUserIds}
            onReviewersChange={drafts.setReviewerUserIds}
            reviewFieldDefs={data.reviewFieldDefs}
            fieldValueDrafts={details.fieldValueDrafts}
            onFieldDraftChange={details.setFieldValueDraft}
            savedFieldValue={details.savedFieldValue}
            fieldPlaceholder={(type) => fieldPlaceholder(type, t)}
            savingFieldIds={details.savingFieldIds}
            onSaveFieldValue={(fieldId) => void details.saveFieldValue(fieldId)}
            hasReviewChanges={details.hasReviewChanges}
            savingReview={details.savingReview}
            onSaveReview={() => void details.saveReview()}
            generalCommentTarget={generalCommentTarget}
            inlineCommentTarget={inline.inlineCommentTarget}
            targetKey={targetKey}
            toggleInlineComment={inline.toggleInlineComment}
            renderInlineCommentComposer={renderers.renderInlineCommentComposer}
            renderInlineCommentThreads={renderers.renderInlineCommentThreads}
            generalCommentThreads={commentThreadsForTarget(
              reviewComments,
              generalCommentTarget,
            )}
          />
        ) : null}

        {activeReviewTab === "files" ? (
          <ReviewFilesTab
            review={review}
            reviewComments={reviewComments}
            currentUserId={currentUser?.id}
            commitLogLinkRules={data.commitLogLinkRules}
            permissions={permissions}
            statusActions={statusActions}
            fileViews={fileViews}
            diffNavigation={diffNavigation}
            inline={inline}
            renderers={renderers}
            commitNavOpen={commitNavOpen}
            setCommitNavOpen={setCommitNavOpen}
            commitActionMenuOpenId={commitActionMenuOpenId}
            setCommitActionMenuOpenId={setCommitActionMenuOpenId}
          />
        ) : null}

        {activeReviewTab === "comments" ? (
          <CommentsTabPanel
            threads={commentThreadsFrom(reviewComments)}
            currentUser={renderers.currentUserSummary}
            idToken={idToken}
            filter={discussionFilter}
            onFilterChange={setDiscussionFilter}
            sort={discussionSort}
            onSortChange={setDiscussionSort}
            isDiscussionExpanded={expansion.isDiscussionExpanded}
            onToggleDiscussion={expansion.toggleDiscussionExpanded}
            onExpandAll={expansion.expandAllDiscussions}
            onCollapseAll={expansion.collapseAllDiscussions}
            areRepliesExpanded={expansion.areRepliesExpanded}
            onToggleReplies={expansion.toggleRepliesExpanded}
            newReplyCount={renderers.newReplyCount}
            threadDiffAvailable={threadDiffAvailable}
            onOpenDiffForThread={(thread) => {
              if (threadDiffAvailable(thread)) {
                diffNavigation.openDiffLocation(thread);
              }
            }}
            renderUserLabel={userLabel}
            messageActions={renderers.messageActions}
            threadTargetLabel={(target) => commentTargetLabel(target, t)}
            canUpdateDone={permissions.canUpdateCommentDone}
            savingDoneCommentIds={comments.savingDoneCommentIds}
            onToggleDone={(thread, done) =>
              void comments.updateCommentDone(thread, done)
            }
            replyDrafts={comments.replyDrafts}
            savingReplyCommentIds={comments.savingReplyCommentIds}
            onReplyDraftChange={comments.setReplyDraft}
            onSubmitReply={(thread) => void comments.addCommentReply(thread)}
            onSubmitReplyAndResolve={(thread) =>
              void comments.addCommentReply(thread, { resolve: true })
            }
          />
        ) : null}
      </div>

      {sync.syncModalOpen ? (
        <SyncModal
          syncPreview={sync.syncPreview}
          loadingSyncPreview={sync.loadingSyncPreview}
          syncCommitHashes={sync.syncCommitHashes}
          syncingReview={sync.syncingReview}
          onToggleCommit={sync.toggleSyncCommit}
          onClose={sync.closeSyncModal}
          onApply={() => void sync.applySync()}
        />
      ) : null}

      {unposted.blocked ? (
        <UnpostedCommentsModal
          drafts={unposted.unpostedDrafts}
          onStay={unposted.stay}
          onLeave={unposted.leaveWithoutPosting}
        />
      ) : null}
    </div>
  );

  return (
    <MentionUsersProvider users={mentionableUsers(review, reviewComments)}>
      {reviewPageContent}
    </MentionUsersProvider>
  );
}
