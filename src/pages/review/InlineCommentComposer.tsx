import { type ReactNode, useState } from "react";

export function InlineCommentComposer({
  saving,
  labels,
  renderMarkdown,
  onCancel,
  onSubmit,
}: {
  saving: boolean;
  labels: {
    placeholder: string;
    cancel: string;
    submit: string;
    previewEmpty: string;
  };
  renderMarkdown: (value: string) => ReactNode;
  onCancel: () => void;
  onSubmit: (message: string) => void;
}) {
  const [draft, setDraft] = useState("");

  return (
    <div className="diff-inline-comment-panel">
      <div className="diff-inline-comment-editor">
        <textarea
          className="form-control"
          rows={4}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
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
