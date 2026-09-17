import type { ReactNode } from "react";
import { DateTimeText } from "../../components/DateTimeText";
import { UserAvatar } from "../../components/UserAvatar";
import { useI18n } from "../../i18n/I18nProvider";
import type { ReviewComment, ReviewUserSummary } from "../../types/api";
import { MarkdownView } from "./MarkdownView";
import { MentionTextarea } from "./MentionTextarea";
import {
  threadReplies,
  threadRootMessage,
  type ReviewCommentThread,
} from "./review-utils";

export type CommentMessageActions = {
  renderUserLabel: (user: ReviewUserSummary) => ReactNode;
  /** Needed by `UserAvatar` to fetch uploaded pictures. */
  idToken: string | null;
  /** "Author" / "Reviewer" pill next to a reply, or nothing. */
  roleLabel: (user: ReviewUserSummary) => string | null;
  editingCommentId: string | null;
  editCommentDraft: string;
  savingEditCommentIds: string[];
  deletingCommentIds: string[];
  canEditComment: (comment: ReviewComment) => boolean;
  canDeleteComment: (comment: ReviewComment) => boolean;
  onStartEdit: (comment: ReviewComment) => void;
  onCancelEdit: () => void;
  onEditDraftChange: (value: string) => void;
  onUpdateMessage: (comment: ReviewComment) => void;
  onDeleteComment: (comment: ReviewComment) => void;
};

function MessageEditor({
  comment,
  actions,
}: {
  comment: ReviewComment;
  actions: CommentMessageActions;
}) {
  const { t } = useI18n();
  const savingEdit = actions.savingEditCommentIds.includes(comment.id);

  return (
    <div className="review-comment-edit">
      <MentionTextarea
        className="form-control form-control-sm"
        rows={3}
        value={actions.editCommentDraft}
        onChange={actions.onEditDraftChange}
      />
      <div className="d-flex justify-content-end gap-2 mt-2">
        <button
          className="btn btn-outline-secondary btn-sm"
          disabled={savingEdit}
          type="button"
          onClick={actions.onCancelEdit}
        >
          {t("cancel")}
        </button>
        <button
          className="btn btn-primary btn-sm"
          disabled={!actions.editCommentDraft.trim() || savingEdit}
          type="button"
          onClick={() => actions.onUpdateMessage(comment)}
        >
          {savingEdit ? (
            <span className="spinner-border spinner-border-sm me-1" />
          ) : null}
          {t("save")}
        </button>
      </div>
    </div>
  );
}

/** Edit and delete, only on one's own messages. */
function MessageActionButtons({
  comment,
  actions,
}: {
  comment: ReviewComment;
  actions: CommentMessageActions;
}) {
  const { t } = useI18n();
  const editing = actions.editingCommentId === comment.id;
  const canEdit = actions.canEditComment(comment) && !editing;
  const canDelete = actions.canDeleteComment(comment);
  const deleting = actions.deletingCommentIds.includes(comment.id);

  if (!canEdit && !canDelete) {
    return null;
  }

  return (
    <span className="review-comment-message-actions">
      {canEdit ? (
        <button
          aria-label={t("editComment")}
          className="btn btn-sm border-0 p-1"
          title={t("editComment")}
          type="button"
          onClick={() => actions.onStartEdit(comment)}
        >
          <i className="bi bi-pencil" aria-hidden="true" />
        </button>
      ) : null}
      {canDelete ? (
        <button
          aria-label={t("deleteComment")}
          className="btn btn-sm border-0 p-1 text-danger"
          disabled={deleting}
          title={t("deleteComment")}
          type="button"
          onClick={() => actions.onDeleteComment(comment)}
        >
          {deleting ? (
            <span className="spinner-border spinner-border-sm" />
          ) : (
            <i className="bi bi-trash" aria-hidden="true" />
          )}
        </button>
      ) : null}
    </span>
  );
}

/**
 * The body of an expanded conversation: the root message boxed, then the
 * replies hanging off a vertical rail with the composer as its last item.
 * Only the last two replies show until the reader asks for the older ones.
 */
export function CommentMessages({
  thread,
  actions,
  newReplyCount = 0,
  repliesExpanded = false,
  onToggleReplies,
  composer,
}: {
  thread: ReviewCommentThread;
  actions: CommentMessageActions;
  newReplyCount?: number;
  repliesExpanded?: boolean;
  onToggleReplies?: () => void;
  composer?: ReactNode;
}) {
  const { t } = useI18n();
  const root = threadRootMessage(thread);
  const replies = threadReplies(thread);
  const hiddenCount = repliesExpanded ? 0 : Math.max(0, replies.length - 2);
  const visibleReplies = hiddenCount ? replies.slice(-2) : replies;
  const editingRoot = actions.editingCommentId === root.id;

  return (
    <div className="review-comment-body">
      <div className="review-comment-root">
        <div className="review-comment-root-text">
          {editingRoot ? (
            <MessageEditor comment={root} actions={actions} />
          ) : (
            <div className="markdown-body">
              <MarkdownView value={root.message} />
            </div>
          )}
        </div>
        <MessageActionButtons comment={root} actions={actions} />
      </div>

      {replies.length || composer ? (
        <div className="review-comment-rail">
          {newReplyCount ? (
            <div className="review-comment-new-banner">
              <span className="review-comment-new-pill">
                {newReplyCount === 1
                  ? t("newReplyOne")
                  : t("newReplyMany", { count: newReplyCount })}
              </span>
              <span className="review-comment-new-rule" />
            </div>
          ) : null}

          {hiddenCount ? (
            <div className="review-comment-show-previous">
              <button type="button" onClick={onToggleReplies}>
                <i className="bi bi-chevron-down" aria-hidden="true" />
                {hiddenCount === 1
                  ? t("showPreviousReplyOne")
                  : t("showPreviousReplyMany", { count: hiddenCount })}
              </button>
            </div>
          ) : null}

          <div className="review-comment-messages">
            {visibleReplies.map((comment) => (
              <ReplyMessage
                key={comment.id}
                comment={comment}
                actions={actions}
              />
            ))}
            {composer}
          </div>
        </div>
      ) : null}
    </div>
  );
}

/** One reply on the rail: avatar, author, date and role, then the text. */
function ReplyMessage({
  comment,
  actions,
}: {
  comment: ReviewComment;
  actions: CommentMessageActions;
}) {
  const { t } = useI18n();
  const editing = actions.editingCommentId === comment.id;
  const role = actions.roleLabel(comment.author);

  return (
    <div className="review-comment-message">
      <UserAvatar user={comment.author} idToken={actions.idToken} />
      <div className="review-comment-message-content">
        <div className="review-comment-message-meta">
          <span className="fw-semibold">
            {actions.renderUserLabel(comment.author)}
          </span>{" "}
          <DateTimeText label={t("createdAt")} value={comment.createdAt} />{" "}
          {role ? <span className="review-comment-role">{role}</span> : null}
          <MessageActionButtons comment={comment} actions={actions} />
        </div>
        {editing ? (
          <MessageEditor comment={comment} actions={actions} />
        ) : (
          <div className="markdown-body">
            <MarkdownView value={comment.message} />
          </div>
        )}
      </div>
    </div>
  );
}
