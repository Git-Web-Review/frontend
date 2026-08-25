import type { ReactNode } from "react";
import { useI18n } from "../../i18n/I18nProvider";
import { formatDateTime } from "../../utils/formatDate";
import type {
  ReviewComment,
  ReviewUserSummary,
} from "../../types/api";
import { MarkdownView } from "./MarkdownView";
import type { ReviewCommentThread } from "./review-utils";

export type CommentMessageActions = {
  renderUserLabel: (user: ReviewUserSummary) => ReactNode;
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

export function CommentMessages({
  thread,
  actions,
}: {
  thread: ReviewCommentThread;
  actions: CommentMessageActions;
}) {
  const { t } = useI18n();

  return (
    <div className="review-comment-messages">
      {thread.messages.map((comment, index) => {
        const previousComment = thread.messages[index - 1];
        const repeatedAuthor =
          previousComment?.author.id === comment.author.id;
        const editing = actions.editingCommentId === comment.id;
        const savingEdit = actions.savingEditCommentIds.includes(comment.id);
        const canEdit = actions.canEditComment(comment) && !editing;
        const canDelete = actions.canDeleteComment(comment);
        const showMeta = !repeatedAuthor || canEdit || canDelete;

        return (
          <div className="review-comment-message" key={comment.id}>
            {showMeta ? (
              <div
                className={`review-comment-message-meta${
                  repeatedAuthor ? " is-compact" : ""
                }`}
              >
                {!repeatedAuthor ? (
                  <>
                    <span className="fw-semibold">
                      {actions.renderUserLabel(comment.author)}
                    </span>
                    <span>{formatDateTime(comment.createdAt)}</span>
                  </>
                ) : null}
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
                    disabled={actions.deletingCommentIds.includes(comment.id)}
                    title={t("deleteComment")}
                    type="button"
                    onClick={() => actions.onDeleteComment(comment)}
                  >
                    {actions.deletingCommentIds.includes(comment.id) ? (
                      <span className="spinner-border spinner-border-sm" />
                    ) : (
                      <i className="bi bi-trash" aria-hidden="true" />
                    )}
                  </button>
                ) : null}
              </div>
            ) : null}
            {editing ? (
              <div className="review-comment-edit">
                <textarea
                  className="form-control form-control-sm"
                  rows={3}
                  value={actions.editCommentDraft}
                  onChange={(event) =>
                    actions.onEditDraftChange(event.target.value)
                  }
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
            ) : (
              <div className="markdown-body">
                <MarkdownView value={comment.message} />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export function CommentReplyForm({
  thread,
  draft,
  saving,
  onDraftChange,
  onSubmit,
}: {
  thread: ReviewCommentThread;
  draft: string;
  saving: boolean;
  onDraftChange: (value: string) => void;
  onSubmit: () => void;
}) {
  const { t } = useI18n();

  return (
    <div className="review-comment-reply">
      <textarea
        className="form-control form-control-sm"
        rows={2}
        value={draft}
        onChange={(event) => onDraftChange(event.target.value)}
        placeholder={t("replyCommentPlaceholder")}
      />
      <div className="d-flex justify-content-end mt-2">
        <button
          className="btn btn-primary btn-sm"
          disabled={!draft.trim() || saving}
          type="button"
          onClick={onSubmit}
        >
          {saving ? (
            <span className="spinner-border spinner-border-sm me-1" />
          ) : null}
          {t("replyComment")}
        </button>
      </div>
    </div>
  );
}

export function CommentThreadControls({
  thread,
  showTargetLabel = false,
  targetLabel,
  canUpdateDone,
  savingDone,
  onToggleDone,
}: {
  thread: ReviewCommentThread;
  showTargetLabel?: boolean;
  targetLabel: string;
  canUpdateDone: boolean;
  savingDone: boolean;
  onToggleDone: () => void;
}) {
  const { t } = useI18n();

  return (
    <>
      <span className="badge review-meta-badge">
        {thread.messages.length} {t("commentMessages")}
      </span>
      {thread.done ? (
        <span className="badge text-bg-success">{t("commentDone")}</span>
      ) : null}
      {showTargetLabel ? (
        <span className="badge text-bg-secondary">{targetLabel}</span>
      ) : null}
      {canUpdateDone ? (
        <button
          className={`btn btn-sm border-0 p-1 ${thread.done ? "text-secondary" : "text-success"}`}
          disabled={savingDone}
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onToggleDone();
          }}
        >
          {thread.done ? t("reopenComment") : t("markCommentDone")}
        </button>
      ) : null}
    </>
  );
}

export function CommentDoneMeta({
  thread,
  renderUserLabel,
}: {
  thread: ReviewCommentThread;
  renderUserLabel: (user: ReviewUserSummary) => ReactNode;
}) {
  const { t } = useI18n();

  if (!thread.done || !thread.doneAt) {
    return null;
  }

  return (
    <div className="comment-done-meta">
      {t("commentDoneBy")}{" "}
      {thread.doneBy ? renderUserLabel(thread.doneBy) : t("notAvailable")} -{" "}
      {formatDateTime(thread.doneAt)}
    </div>
  );
}
