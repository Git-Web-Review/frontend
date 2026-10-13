import { useState } from "react";
import { apiRequest } from "../../api/client";
import { useAuth } from "../../auth/AuthProvider";
import { useI18n } from "../../i18n/I18nProvider";
import { WebhookExampleModal } from "./WebhookExampleModal";

type TestResult =
  | { state: "idle" | "testing" | "ok" }
  | { state: "failed"; message: string };

/** The webhook URL, with a way to try it and a receiver example to start from. */
export function WebhookUrlField({
  value,
  invalid,
  onChange,
}: {
  value: string;
  invalid: boolean;
  onChange: (value: string) => void;
}) {
  const { t } = useI18n();
  const { idToken } = useAuth();
  const [exampleOpen, setExampleOpen] = useState(false);
  const [result, setResult] = useState<TestResult>({ state: "idle" });

  const test = async () => {
    if (!idToken) {
      return;
    }
    setResult({ state: "testing" });
    try {
      await apiRequest("/me/settings/webhook-test", idToken, {
        method: "POST",
        body: JSON.stringify({ webhookUrl: value.trim() }),
      });
      setResult({ state: "ok" });
    } catch (error) {
      setResult({
        state: "failed",
        message: error instanceof Error ? error.message : t("backendError"),
      });
    }
  };

  const feedback = invalid ? (
    <div className="invalid-feedback d-block">{t("webhookUrlInvalid")}</div>
  ) : result.state === "ok" ? (
    <div className="valid-feedback d-block">{t("webhookTestSucceeded")}</div>
  ) : result.state === "failed" ? (
    <div className="invalid-feedback d-block">{result.message}</div>
  ) : (
    <div className="form-text">{t("webhookUrlHelp")}</div>
  );

  return (
    <>
      <label className="form-label" htmlFor="webhook-url">
        {t("webhookUrl")}
      </label>
      <button
        className="btn btn-link btn-sm p-0 ms-2 align-baseline"
        type="button"
        title={t("webhookExampleOpen")}
        aria-label={t("webhookExampleOpen")}
        onClick={() => setExampleOpen(true)}
      >
        <i className="bi bi-book" />
      </button>
      <div className="input-group">
        <input
          className={`form-control${
            invalid || result.state === "failed"
              ? " is-invalid"
              : result.state === "ok"
                ? " is-valid"
                : ""
          }`}
          id="webhook-url"
          type="url"
          placeholder="https://chat.company.tld/hooks/..."
          value={value}
          onChange={(event) => {
            setResult({ state: "idle" });
            onChange(event.target.value);
          }}
        />
        <button
          className="btn btn-outline-secondary"
          type="button"
          disabled={invalid || !value.trim() || result.state === "testing"}
          onClick={() => void test()}
        >
          {result.state === "testing" ? (
            <span className="spinner-border spinner-border-sm me-2" />
          ) : (
            <i className="bi bi-plug me-1" />
          )}
          {t("webhookTest")}
        </button>
      </div>
      {feedback}
      {exampleOpen ? (
        <WebhookExampleModal onClose={() => setExampleOpen(false)} />
      ) : null}
    </>
  );
}
