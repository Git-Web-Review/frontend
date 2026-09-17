import { useI18n } from "../../i18n/I18nProvider";
import type { ReviewField } from "../../types/api";

type ReviewFieldValuesProps = {
  fields: ReviewField[];
  canEdit: boolean;
  drafts: Record<string, string>;
  onDraftChange: (fieldId: string, value: string) => void;
  savedValue: (fieldId: string) => string;
  placeholder: (type: ReviewField["type"]) => string;
  savingFieldIds: string[];
  onSave: (fieldId: string) => void;
};

/** The admin-defined fields of the review, each saved on its own. */
export function ReviewFieldValues(props: ReviewFieldValuesProps) {
  const { t } = useI18n();

  if (!props.fields.length) {
    return null;
  }

  return (
    <div className="mb-3">
      <span className="form-label d-block">{t("reviewFields")}</span>
      {props.fields.map((field) => (
        <ReviewFieldValue key={field.id} field={field} {...props} />
      ))}
    </div>
  );
}

function ReviewFieldValue({
  field,
  canEdit,
  drafts,
  onDraftChange,
  savedValue,
  placeholder,
  savingFieldIds,
  onSave,
}: ReviewFieldValuesProps & { field: ReviewField }) {
  const { t } = useI18n();
  const draft = drafts[field.id] ?? "";
  const saved = savedValue(field.id);
  const changed = draft.trim() !== saved;
  const saving = savingFieldIds.includes(field.id);
  const inputId = `review-field-${field.id}`;

  return (
    <div className="mb-2">
      <label className="form-label small mb-1" htmlFor={inputId}>
        {field.name}
      </label>
      <div className="input-group input-group-sm">
        {field.type === "TEXT" ? (
          <textarea
            className="form-control"
            id={inputId}
            disabled={!canEdit}
            placeholder={placeholder(field.type)}
            rows={3}
            value={draft}
            onChange={(event) => onDraftChange(field.id, event.target.value)}
          />
        ) : (
          <input
            className="form-control"
            id={inputId}
            disabled={!canEdit}
            placeholder={placeholder(field.type)}
            type={field.type === "NUMBER" ? "number" : "url"}
            value={draft}
            onChange={(event) => onDraftChange(field.id, event.target.value)}
          />
        )}
        {canEdit && changed ? (
          <button
            className="btn btn-outline-success d-inline-flex align-items-center gap-1"
            type="button"
            disabled={saving}
            onClick={() => onSave(field.id)}
          >
            {saving ? (
              <span className="spinner-border spinner-border-sm" />
            ) : (
              <i className="bi bi-save" aria-hidden="true" />
            )}
            {t("save")}
          </button>
        ) : null}
      </div>
      {saved && field.type === "LINK" ? (
        <a
          className="small text-break d-inline-flex align-items-center gap-1 mt-1"
          href={saved}
          rel="noreferrer"
          target="_blank"
        >
          <i className="bi bi-box-arrow-up-right" aria-hidden="true" />
          {saved}
        </a>
      ) : null}
      {saved && field.type === "IMAGE" ? (
        <a className="d-block mt-1" href={saved} rel="noreferrer" target="_blank">
          <img alt={field.name} className="review-field-image" src={saved} />
        </a>
      ) : null}
    </div>
  );
}
