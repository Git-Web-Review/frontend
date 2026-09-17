import { useEffect, useRef, useState } from "react";
import { useI18n } from "../../i18n/I18nProvider";

export type UnpostedCommentDraft = {
  key: string;
  kind: "comment" | "reply" | "edit";
  /** Where the draft would have gone: file and line, thread, review. */
  targetLabel: string;
  message: string;
};

const kindIcon: Record<UnpostedCommentDraft["kind"], string> = {
  comment: "bi-chat-left-text",
  reply: "bi-reply",
  edit: "bi-pencil",
};

function DraftBlock({ draft }: { draft: UnpostedCommentDraft }) {
  const { t } = useI18n();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) {
      return;
    }
    const timeout = window.setTimeout(() => setCopied(false), 2000);
    return () => window.clearTimeout(timeout);
  }, [copied]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(draft.message);
      setCopied(true);
    } catch {
      // No clipboard API over plain http: fall back to the selection, which
      // also leaves the text highlighted for a manual Ctrl+C if this fails.
      textareaRef.current?.select();
      setCopied(document.execCommand("copy"));
    }
  };

  const kindLabel =
    draft.kind === "reply"
      ? t("unpostedReply")
      : draft.kind === "edit"
        ? t("unpostedEdit")
        : t("unpostedComment");

  return (
    <div className="unposted-draft">
      <div className="unposted-draft-header">
        <span className="unposted-draft-label" title={draft.targetLabel}>
          <i className={`bi ${kindIcon[draft.kind]}`} aria-hidden="true" />
          <span className="unposted-draft-kind">{kindLabel}</span>
          <span className="unposted-draft-target">{draft.targetLabel}</span>
        </span>
        <button
          className={`btn btn-outline-secondary btn-sm d-inline-flex align-items-center gap-1${
            copied ? " is-copied" : ""
          }`}
          type="button"
          onClick={() => void copy()}
        >
          <i
            className={`bi ${copied ? "bi-check2" : "bi-clipboard"}`}
            aria-hidden="true"
          />
          {copied ? t("unpostedCopied") : t("copy")}
        </button>
      </div>
      <textarea
        aria-label={kindLabel}
        className="form-control"
        readOnly
        ref={textareaRef}
        rows={Math.min(Math.max(draft.message.split("\n").length, 2), 10)}
        value={draft.message}
        onFocus={(event) => event.currentTarget.select()}
      />
    </div>
  );
}

/**
 * Shown when leaving a review would drop comments that were started but
 * never posted, which only happens once the browser refused to store them.
 * Each one can be copied before it is gone.
 */
export function UnpostedCommentsModal({
  drafts,
  onStay,
  onLeave,
}: {
  drafts: UnpostedCommentDraft[];
  onStay: () => void;
  onLeave: () => void;
}) {
  const { t } = useI18n();
  const single = drafts.length === 1;

  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onStay();
      }
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [onStay]);

  return (
    <>
      <div
        aria-labelledby="unposted-comments-title"
        aria-modal="true"
        className="modal d-block"
        role="dialog"
      >
        <div className="modal-dialog modal-dialog-centered modal-lg">
          <div className="modal-content">
            <div className="modal-header">
              <span className="unposted-comments-icon" aria-hidden="true">
                <i className="bi bi-exclamation-triangle" />
              </span>
              <div className="flex-grow-1">
                <h5 className="modal-title" id="unposted-comments-title">
                  {single
                    ? t("unpostedCommentsTitleOne")
                    : t("unpostedCommentsTitleMany", { count: drafts.length })}
                </h5>
                <div className="small">
                  {single
                    ? t("unpostedCommentsHintOne")
                    : t("unpostedCommentsHintMany")}
                </div>
              </div>
              <button
                aria-label={t("close")}
                className="btn-close"
                type="button"
                onClick={onStay}
              />
            </div>
            <div className="modal-body">
              <div className="unposted-draft-list">
                {drafts.map((draft) => (
                  <DraftBlock draft={draft} key={draft.key} />
                ))}
              </div>
            </div>
            <div className="modal-footer">
              <button
                className="btn btn-outline-danger d-inline-flex align-items-center gap-2"
                type="button"
                onClick={onLeave}
              >
                <i className="bi bi-trash" aria-hidden="true" />
                {single ? t("unpostedLeaveOne") : t("unpostedLeaveMany")}
              </button>
              <button
                autoFocus
                className="btn btn-primary"
                type="button"
                onClick={onStay}
              >
                {t("unpostedStay")}
              </button>
            </div>
          </div>
        </div>
      </div>
      <div className="modal-backdrop show" />
    </>
  );
}
