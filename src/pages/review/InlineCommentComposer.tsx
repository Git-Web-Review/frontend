import { useEffect, useState, type ReactNode } from "react";
import { MentionTextarea } from "./MentionTextarea";

/** How long typing has to pause before the preview is rendered again. */
const PREVIEW_DELAY_MS = 1500;

/** `value`, once it has stopped changing for `delayMs`. */
function useSettledValue(value: string, delayMs: number) {
  const [settled, setSettled] = useState(value);
  useEffect(() => {
    const timer = window.setTimeout(() => setSettled(value), delayMs);
    return () => window.clearTimeout(timer);
  }, [value, delayMs]);
  return settled;
}

export function InlineCommentComposer({
  draft,
  saving,
  labels,
  renderMarkdown,
  onDraftChange,
  onCancel,
  onSubmit,
}: {
  /** Owned by the page, so leaving it can warn about an unposted comment. */
  draft: string;
  saving: boolean;
  labels: {
    placeholder: string;
    cancel: string;
    submit: string;
    previewEmpty: string;
  };
  renderMarkdown: (value: string) => ReactNode;
  onDraftChange: (value: string) => void;
  onCancel: () => void;
  onSubmit: (message: string) => void;
}) {
  const previewDraft = useSettledValue(draft, PREVIEW_DELAY_MS);
  const previewPending = previewDraft !== draft;

  return (
    <div className="diff-inline-comment-panel">
      <div className="diff-inline-comment-editor">
        <MentionTextarea
          className="form-control"
          rows={4}
          value={draft}
          onChange={onDraftChange}
          placeholder={labels.placeholder}
        />
        <div className="diff-inline-comment-actions">
          <button
            className="btn btn-outline-secondary btn-sm"
            type="button"
            onClick={onCancel}
          >
            {labels.cancel}
          </button>
          <button
            className="btn btn-primary btn-sm"
            type="button"
            disabled={!draft.trim() || saving}
            onClick={() => onSubmit(draft.trim())}
          >
            {labels.submit}
          </button>
        </div>
      </div>
      <div
        className={`diff-inline-comment-preview markdown-body${
          previewPending ? " is-pending" : ""
        }`}
        aria-busy={previewPending}
      >
        {previewPending ? (
          <span
            className="diff-inline-comment-preview-spinner spinner-border spinner-border-sm"
            aria-hidden="true"
          />
        ) : null}
        {previewDraft.trim()
          ? renderMarkdown(previewDraft)
          : labels.previewEmpty}
      </div>
    </div>
  );
}
