import { UserAvatar } from "../../components/UserAvatar";
import { useI18n } from "../../i18n/I18nProvider";
import type { ReviewUserSummary } from "../../types/api";
import { MentionTextarea } from "./MentionTextarea";

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
        <MentionTextarea
          className="form-control form-control-sm"
          rows={compact ? 1 : 2}
          value={draft}
          onChange={onDraftChange}
          placeholder={t("replyCommentPlaceholder")}
        />
        <div className="review-comment-reply-footer">
          <span className="review-comment-reply-hint">
            {t("markdownSupported")} · {t("mentionHint")}
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
