import { useEffect, useState } from "react";
import { ApiClientError, apiRequest } from "../../../api/client";
import { useAuth } from "../../../auth/AuthProvider";
import { RefreshButton } from "../../../components/RefreshButton";
import { useI18n } from "../../../i18n/I18nProvider";
import { useToast } from "../../../layout/ToastProvider";
import type {
  ReviewField,
  ReviewFieldDeletion,
  ReviewFieldType,
} from "../../../types/api";

type ReviewFieldDraft = {
  name: string;
  type: ReviewFieldType;
};

const reviewFieldTypes: ReviewFieldType[] = ["LINK", "IMAGE", "TEXT", "NUMBER"];

export function ReviewFieldsTab() {
  const { idToken } = useAuth();
  const { t } = useI18n();
  const { showToast } = useToast();
  const [reviewFields, setReviewFields] = useState<ReviewField[]>([]);
  const [reviewFieldDrafts, setReviewFieldDrafts] = useState<
    Record<string, ReviewFieldDraft>
  >({});
  const [newReviewField, setNewReviewField] = useState<ReviewFieldDraft>({
    name: "",
    type: "TEXT",
  });
  const [loadingReviewFields, setLoadingReviewFields] = useState(false);
  const [savingReviewField, setSavingReviewField] = useState(false);
  const [updatingReviewFieldId, setUpdatingReviewFieldId] = useState<
    string | null
  >(null);
  const [deletingReviewFieldId, setDeletingReviewFieldId] = useState<
    string | null
  >(null);
  const [errorMessage, setErrorMessage] = useState("");

  const errorLabel = (error: unknown) => {
    if (error instanceof ApiClientError) {
      return t(error.apiError.code);
    }

    return error instanceof Error ? error.message : t("backendError");
  };

  const loadReviewFields = async () => {
    if (!idToken) {
      return;
    }

    setLoadingReviewFields(true);
    setErrorMessage("");
    try {
      const fields = await apiRequest<ReviewField[]>(
        "/v1/review-fields",
        idToken,
      );
      setReviewFields(fields);
      setReviewFieldDrafts(
        Object.fromEntries(
          fields.map((field) => [
            field.id,
            { name: field.name, type: field.type },
          ]),
        ),
      );
    } catch (error) {
      setErrorMessage(errorLabel(error));
    } finally {
      setLoadingReviewFields(false);
    }
  };

  useEffect(() => {
    void loadReviewFields();
  }, [idToken]);

  const reviewFieldDraftChanged = (
    field: ReviewField,
    draft: ReviewFieldDraft | undefined,
  ) => !!draft && (draft.name !== field.name || draft.type !== field.type);

  const updateReviewFieldDraft = (
    fieldId: string,
    nextDraft: Partial<ReviewFieldDraft>,
  ) => {
    setReviewFieldDrafts((current) => ({
      ...current,
      [fieldId]: { ...current[fieldId], ...nextDraft },
    }));
  };

  const createReviewField = async () => {
    if (!idToken || !newReviewField.name.trim()) {
      return;
    }

    setSavingReviewField(true);
    setErrorMessage("");
    try {
      await apiRequest<ReviewField>("/v1/review-fields", idToken, {
        method: "POST",
        body: JSON.stringify({
          name: newReviewField.name.trim(),
          type: newReviewField.type,
        }),
      });
      setNewReviewField({ name: "", type: "TEXT" });
      showToast(t("reviewFieldCreated"));
      await loadReviewFields();
    } catch (error) {
      setErrorMessage(errorLabel(error));
    } finally {
      setSavingReviewField(false);
    }
  };

  const updateReviewField = async (fieldId: string) => {
    const draft = reviewFieldDrafts[fieldId];
    const field = reviewFields.find(
      (currentField) => currentField.id === fieldId,
    );
    if (
      !idToken ||
      !field ||
      !draft?.name.trim() ||
      !reviewFieldDraftChanged(field, draft)
    ) {
      return;
    }

    setUpdatingReviewFieldId(fieldId);
    setErrorMessage("");
    try {
      await apiRequest<ReviewField>(`/v1/review-fields/${fieldId}`, idToken, {
        method: "PATCH",
        body: JSON.stringify({ name: draft.name.trim(), type: draft.type }),
      });
      showToast(t("reviewFieldUpdated"));
      await loadReviewFields();
    } catch (error) {
      setErrorMessage(errorLabel(error));
    } finally {
      setUpdatingReviewFieldId(null);
    }
  };

  const deleteReviewField = async (fieldId: string) => {
    if (!idToken) {
      return;
    }

    setDeletingReviewFieldId(fieldId);
    setErrorMessage("");
    try {
      await apiRequest<ReviewFieldDeletion>(
        `/v1/review-fields/${fieldId}`,
        idToken,
        { method: "DELETE" },
      );
      showToast(t("reviewFieldDeleted"));
      await loadReviewFields();
    } catch (error) {
      setErrorMessage(errorLabel(error));
    } finally {
      setDeletingReviewFieldId(null);
    }
  };

  const reviewFieldTypeLabel = (type: ReviewFieldType) => {
    if (type === "LINK") {
      return t("fieldTypeLink");
    }
    if (type === "IMAGE") {
      return t("fieldTypeImage");
    }
    if (type === "NUMBER") {
      return t("fieldTypeNumber");
    }

    return t("fieldTypeText");
  };

  return (
    <div className="col-12">
      <div className="card card-primary card-outline">
        <div className="card-header d-flex flex-wrap align-items-center justify-content-between gap-3">
          <h3 className="card-title mb-0">{t("reviewFields")}</h3>
          <RefreshButton
            disabled={!idToken}
            loading={loadingReviewFields}
            onClick={() => void loadReviewFields()}
          />
        </div>
        <div className="card-body">
          {errorMessage ? (
            <div className="alert alert-danger">{errorMessage}</div>
          ) : null}
          <p className="text-secondary small mb-3">{t("reviewFieldsHint")}</p>
          <div className="row g-2 align-items-end mb-3">
            <div className="col-lg-5">
              <label className="form-label" htmlFor="new-review-field-name">
                {t("fieldName")}
              </label>
              <input
                className="form-control"
                id="new-review-field-name"
                value={newReviewField.name}
                onChange={(event) =>
                  setNewReviewField((current) => ({
                    ...current,
                    name: event.target.value,
                  }))
                }
              />
            </div>
            <div className="col-lg-4">
              <label className="form-label" htmlFor="new-review-field-type">
                {t("fieldType")}
              </label>
              <select
                className="form-select"
                id="new-review-field-type"
                value={newReviewField.type}
                onChange={(event) =>
                  setNewReviewField((current) => ({
                    ...current,
                    type: event.target.value as ReviewFieldType,
                  }))
                }
              >
                {reviewFieldTypes.map((type) => (
                  <option key={type} value={type}>
                    {reviewFieldTypeLabel(type)}
                  </option>
                ))}
              </select>
            </div>
            <div className="col-lg-3">
              <button
                className="btn btn-primary d-inline-flex align-items-center gap-2"
                type="button"
                disabled={!newReviewField.name.trim() || savingReviewField}
                onClick={() => void createReviewField()}
              >
                {savingReviewField ? (
                  <span className="spinner-border spinner-border-sm" />
                ) : (
                  <i className="bi bi-plus-lg" aria-hidden="true" />
                )}
                {t("add")}
              </button>
            </div>
          </div>

          {reviewFields.length ? (
            <div className="table-responsive">
              <table className="table table-hover align-middle mb-0">
                <thead>
                  <tr>
                    <th>{t("fieldName")}</th>
                    <th>{t("fieldType")}</th>
                    <th className="text-end">{t("actions")}</th>
                  </tr>
                </thead>
                <tbody>
                  {reviewFields.map((field) => {
                    const draft = reviewFieldDrafts[field.id];
                    const hasFieldChanges = reviewFieldDraftChanged(
                      field,
                      draft,
                    );

                    return (
                      <tr key={field.id}>
                        <td className="link-rule-cell">
                          <input
                            className="form-control form-control-sm"
                            value={draft?.name ?? ""}
                            onChange={(event) =>
                              updateReviewFieldDraft(field.id, {
                                name: event.target.value,
                              })
                            }
                          />
                        </td>
                        <td className="link-rule-cell">
                          <select
                            className="form-select form-select-sm"
                            value={draft?.type ?? field.type}
                            onChange={(event) =>
                              updateReviewFieldDraft(field.id, {
                                type: event.target.value as ReviewFieldType,
                              })
                            }
                          >
                            {reviewFieldTypes.map((type) => (
                              <option key={type} value={type}>
                                {reviewFieldTypeLabel(type)}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="text-end">
                          <div className="d-inline-flex flex-wrap justify-content-end gap-2">
                            {draft?.name.trim() && hasFieldChanges ? (
                              <button
                                className="btn btn-outline-success btn-sm d-inline-flex align-items-center gap-2"
                                type="button"
                                disabled={updatingReviewFieldId === field.id}
                                onClick={() => void updateReviewField(field.id)}
                              >
                                {updatingReviewFieldId === field.id ? (
                                  <span className="spinner-border spinner-border-sm" />
                                ) : (
                                  <i
                                    className="bi bi-save"
                                    aria-hidden="true"
                                  />
                                )}
                                {t("save")}
                              </button>
                            ) : null}
                            <button
                              className="btn btn-outline-danger btn-sm d-inline-flex align-items-center gap-2"
                              type="button"
                              disabled={deletingReviewFieldId === field.id}
                              onClick={() => void deleteReviewField(field.id)}
                            >
                              {deletingReviewFieldId === field.id ? (
                                <span className="spinner-border spinner-border-sm" />
                              ) : (
                                <i
                                  className="bi bi-trash"
                                  aria-hidden="true"
                                />
                              )}
                              {t("remove")}
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="empty-state border rounded">
              {loadingReviewFields
                ? t("loadingReviewFields")
                : t("noReviewFields")}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
