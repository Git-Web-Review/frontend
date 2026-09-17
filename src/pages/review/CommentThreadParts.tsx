import type { ReactNode } from "react";
import { DateTimeText } from "../../components/DateTimeText";
import { UserAvatar } from "../../components/UserAvatar";
import { useI18n } from "../../i18n/I18nProvider";
import type {
  ReviewComment,
  ReviewUserSummary,
} from "../../types/api";
import { MarkdownView } from "./MarkdownView";
import {
  threadChipLabel,
  threadLastMessage,
  threadParticipants,
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
      <textarea
        className="form-control form-control-sm"
        rows={3}
        value={actions.editCommentDraft}
        onChange={(event) => actions.onEditDraftChange(event.target.value)}
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
 * First line of a thread header: who opened it and when, then either the
 * open badge or — once resolved — who closed it. A resolved thread is meant
 * to recede, so it gets no uppercase DONE badge.
 */
export function CommentThreadIdentityLine({
  thread,
  renderUserLabel,
  showOpenedBy = false,
  compact = false,
}: {
  thread: ReviewCommentThread;
  renderUserLabel: (user: ReviewUserSummary) => string;
  /** Set while expanded, where no collapsed summary carries the opener. */
  showOpenedBy?: boolean;
  /** Diff variant: bare author and date, no wording, no open badge. */
  compact?: boolean;
}) {
  const { t } = useI18n();
  const root = threadRootMessage(thread);
  const opener = (
    <>
      <span className="comment-thread-author">
        {renderUserLabel(root.author)}
      </span>{" "}
      <span className="comment-thread-time">
        {compact ? null : `${t("openedConversation")} `}
        <DateTimeText label={t("createdAt")} value={thread.createdAt} />
      </span>
    </>
  );

  if (thread.done) {
    return (
      <div className="comment-thread-line">
        {showOpenedBy ? <>{opener} </> : null}
        <span className="comment-thread-resolved-label">
          <i className="bi bi-check2-circle" aria-hidden="true" />
          {t("commentResolved")}
        </span>{" "}
        {thread.doneBy || thread.doneAt ? (
          <span className="comment-thread-time">
            {thread.doneBy
              ? t("commentResolvedBy", { user: renderUserLabel(thread.doneBy) })
              : ""}
            {thread.doneAt ? (
              <>
                {thread.doneBy ? " · " : ""}
                <DateTimeText value={thread.doneAt} />
              </>
            ) : null}
          </span>
        ) : null}
      </div>
    );
  }

  return (
    <div className="comment-thread-line">
      {opener}{" "}
      {compact ? null : (
        <span className="review-status-badge is-in-review">
          {t("commentOpenState")}
        </span>
      )}
    </div>
  );
}

/** Second line: what the thread is attached to, and a way to get there. */
export function CommentThreadTargetLine({
  thread,
  targetLabel,
  diffAvailable,
  onOpenDiff,
}: {
  thread: ReviewCommentThread;
  targetLabel: string;
  diffAvailable: boolean;
  onOpenDiff: () => void;
}) {
  const { t } = useI18n();
  const chipLabel = threadChipLabel(thread);

  if (!chipLabel) {
    return null;
  }

  return (
    <div className="comment-thread-line">
      <span className="comment-thread-target" title={targetLabel}>
        <i
          className={`bi ${
            thread.filePath ? "bi-file-diff" : "bi-chat-square-text"
          }`}
          aria-hidden="true"
        />
        {chipLabel}
      </span>{" "}
      {diffAvailable ? (
        <button
          className="comment-thread-link"
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onOpenDiff();
          }}
        >
          {t("viewDiff")}
        </button>
      ) : null}
    </div>
  );
}

/**
 * What a collapsed thread shows of itself: two lines of the root message,
 * then who took part and how the conversation ended.
 */
export function CommentThreadSummary({
  thread,
  idToken,
  renderUserLabel,
  showParticipants = true,
}: {
  thread: ReviewCommentThread;
  idToken: string | null;
  renderUserLabel: (user: ReviewUserSummary) => string;
  showParticipants?: boolean;
}) {
  const { t } = useI18n();
  const root = threadRootMessage(thread);
  const replies = threadReplies(thread);
  const last = threadLastMessage(thread);
  const participants = threadParticipants(thread);
  const shownParticipants = participants.slice(0, 3);
  const extraParticipants = participants.length - shownParticipants.length;
  const replyLabel =
    replies.length === 1
      ? t("commentReplyOne")
      : t("commentReplyMany", { count: replies.length });

  return (
    <>
      <div className="comment-thread-excerpt markdown-body">
        <MarkdownView value={root.message} />
      </div>
      <div className="comment-thread-footer">
        {showParticipants && participants.length > 1 ? (
          <span className="comment-avatar-stack">
            {shownParticipants.map((participant) => (
              <UserAvatar
                idToken={idToken}
                key={participant.id}
                user={participant}
              />
            ))}
            {extraParticipants > 0 ? (
              <span className="comment-avatar-more">
                {t("moreParticipants", { count: extraParticipants })}
              </span>
            ) : null}
          </span>
        ) : null}{" "}
        <span>
          {thread.done ? (
            <>
              {renderUserLabel(root.author)} {t("openedConversation")}{" "}
              <DateTimeText label={t("createdAt")} value={thread.createdAt} />
              {replies.length ? ` · ${replyLabel}` : ""}
            </>
          ) : replies.length ? (
            <>
              {replyLabel} ·{" "}
              {t("lastReplyBy", { user: renderUserLabel(last.author) })}{" "}
              <DateTimeText label={t("createdAt")} value={last.createdAt} />
            </>
          ) : (
            <DateTimeText label={t("createdAt")} value={thread.createdAt} />
          )}
        </span>{" "}
        <span className="comment-thread-link">{t("expandConversation")}</span>
      </div>
    </>
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
            {visibleReplies.map((comment) => {
              const editing = actions.editingCommentId === comment.id;
              const role = actions.roleLabel(comment.author);

              return (
                <div className="review-comment-message" key={comment.id}>
                  <UserAvatar user={comment.author} idToken={actions.idToken} />
                  <div className="review-comment-message-content">
                    <div className="review-comment-message-meta">
                      <span className="fw-semibold">
                        {actions.renderUserLabel(comment.author)}
                      </span>{" "}
                      <DateTimeText
                        label={t("createdAt")}
                        value={comment.createdAt}
                      />{" "}
                      {role ? (
                        <span className="review-comment-role">{role}</span>
                      ) : null}
                      <MessageActionButtons
                        comment={comment}
                        actions={actions}
                      />
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
            })}
            {composer}
          </div>
        </div>
      ) : null}
    </div>
  );
}

/**
 * Reply composer. `compact` is the diff variant: a pill that only reveals
 * its buttons once it has the focus.
 */
export function CommentReplyForm({
  draft,
  saving,
  currentUser,
  idToken,
  compact = false,
  canResolve,
  onDraftChange,
  onSubmit,
  onSubmitAndResolve,
}: {
  draft: string;
  saving: boolean;
  currentUser: ReviewUserSummary | null;
  idToken: string | null;
  compact?: boolean;
  canResolve: boolean;
  onDraftChange: (value: string) => void;
  onSubmit: () => void;
  onSubmitAndResolve?: () => void;
}) {
  const { t } = useI18n();
  const empty = !draft.trim();

  return (
    <div
      className={`review-comment-reply${compact ? " is-compact" : ""}${
        empty ? "" : " has-draft"
      }`}
    >
      {currentUser ? (
        <UserAvatar user={currentUser} idToken={idToken} />
      ) : null}
      <div className="review-comment-reply-fields">
        <textarea
          className="form-control form-control-sm"
          rows={compact ? 1 : 2}
          value={draft}
          onChange={(event) => onDraftChange(event.target.value)}
          placeholder={t("replyCommentPlaceholder")}
        />
        <div className="review-comment-reply-footer">
          <span className="review-comment-reply-hint">
            {t("markdownSupported")}
          </span>{" "}
          <span className="review-comment-reply-actions">
            {canResolve && onSubmitAndResolve ? (
              <button
                disabled={empty || saving}
                type="button"
                onClick={onSubmitAndResolve}
              >
                <i className="bi bi-check2-all" aria-hidden="true" />
                {t("replyAndResolve")}
              </button>
            ) : null}
            <button
              className="is-primary"
              disabled={empty || saving}
              type="button"
              onClick={onSubmit}
            >
              {saving ? (
                <span className="spinner-border spinner-border-sm" />
              ) : null}
              {t("replyComment")}
            </button>
          </span>
        </div>
      </div>
    </div>
  );
}

/**
 * Right-hand cluster of a thread header: how many replies, the done switch,
 * and the chevron. Clicks never reach the header underneath.
 */
export function CommentThreadControls({
  thread,
  replyCount,
  expanded,
  canUpdateDone,
  savingDone,
  shortDoneLabel = false,
  onToggleDone,
  onToggleExpanded,
}: {
  thread: ReviewCommentThread;
  replyCount: number;
  expanded: boolean;
  canUpdateDone: boolean;
  savingDone: boolean;
  shortDoneLabel?: boolean;
  onToggleDone: () => void;
  onToggleExpanded: () => void;
}) {
  const { t } = useI18n();

  return (
    <div
      className="comment-thread-controls"
      onClick={(event) => event.stopPropagation()}
      onKeyDown={(event) => event.stopPropagation()}
    >
      {replyCount && !thread.done ? (
        <span className="comment-reply-badge">
          <i className="bi bi-chat-left-text" aria-hidden="true" />
          {replyCount === 1
            ? t("commentReplyOne")
            : t("commentReplyMany", { count: replyCount })}
        </span>
      ) : null}
      {canUpdateDone ? (
        <button
          className={`comment-done-button${thread.done ? " is-reopen" : ""}`}
          disabled={savingDone}
          type="button"
          onClick={onToggleDone}
        >
          {savingDone ? (
            <span className="spinner-border spinner-border-sm" />
          ) : (
            <i
              className={`bi ${
                thread.done ? "bi-arrow-counterclockwise" : "bi-check2"
              }`}
              aria-hidden="true"
            />
          )}
          {thread.done
            ? t("reopenComment")
            : shortDoneLabel
              ? t("commentDone")
              : t("markCommentDone")}
        </button>
      ) : null}
      <button
        aria-expanded={expanded}
        aria-label={expanded ? t("collapseConversation") : t("expandConversation")}
        className={`comment-thread-toggle${expanded ? " is-expanded" : ""}`}
        title={expanded ? t("collapseConversation") : t("expandConversation")}
        type="button"
        onClick={onToggleExpanded}
      >
        <i
          className={`bi ${expanded ? "bi-chevron-up" : "bi-chevron-down"}`}
          aria-hidden="true"
        />
      </button>
    </div>
  );
}
