import { DateTimeText } from "../../components/DateTimeText";
import { UserAvatar } from "../../components/UserAvatar";
import { useI18n } from "../../i18n/I18nProvider";
import type { ReviewUserSummary } from "../../types/api";
import { MarkdownView } from "./MarkdownView";
import {
  threadChipLabel,
  threadLastMessage,
  threadParticipants,
  threadReplies,
  threadRootMessage,
  type ReviewCommentThread,
} from "./review-utils";

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
        <span className="badge review-status-badge is-in-review">
          {t("commentOpenState")}
        </span>
      )}
    </div>
  );
}

/** Second line: what the thread is attached to; the chip opens the diff. */
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
  const chipLabel = threadChipLabel(thread);

  if (!chipLabel) {
    return null;
  }

  const chipContent = (
    <>
      <i
        className={`bi ${
          thread.filePath ? "bi-file-diff" : "bi-chat-square-text"
        }`}
        aria-hidden="true"
      />
      {chipLabel}
    </>
  );

  return (
    <div className="comment-thread-line">
      {diffAvailable ? (
        <button
          className="comment-thread-target is-link"
          title={targetLabel}
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onOpenDiff();
          }}
          // The header toggles on Enter/Space; keep those keys for this button.
          onKeyDown={(event) => event.stopPropagation()}
        >
          {chipContent}
          <i
            className="bi bi-arrow-right-short comment-thread-target-go"
            aria-hidden="true"
          />
        </button>
      ) : (
        <span className="comment-thread-target" title={targetLabel}>
          {chipContent}
        </span>
      )}
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
