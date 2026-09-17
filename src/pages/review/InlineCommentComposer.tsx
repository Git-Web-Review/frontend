import type { ReactNode } from "react";
import { MentionTextarea } from "./MentionTextarea";

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
      <div className="diff-inline-comment-preview markdown-body">
        {draft.trim() ? renderMarkdown(draft) : labels.previewEmpty}
      </div>
    </div>
  );
}
