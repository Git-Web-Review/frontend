import { useMemo } from "react";
import { useI18n } from "../../i18n/I18nProvider";
import { hljs } from "../review/diff-highlight";
import webhookReceiver from "./webhook_receiver.py?raw";

const fileName = "webhook_receiver.py";

const download = () => {
  const url = URL.createObjectURL(
    new Blob([webhookReceiver], { type: "text/x-python" }),
  );
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
};

/** A ready-to-run Python receiver for webhook notifications. */
export function WebhookExampleModal({ onClose }: { onClose: () => void }) {
  const { t } = useI18n();
  const highlighted = useMemo(
    () => hljs.highlight(webhookReceiver, { language: "python" }).value,
    [],
  );

  return (
    <div
      className="modal fade show d-block"
      role="dialog"
      tabIndex={-1}
      style={{ backgroundColor: "rgba(0, 0, 0, 0.5)" }}
    >
      <div className="modal-dialog modal-dialog-centered modal-dialog-scrollable modal-xl">
        <div className="modal-content">
          <div className="modal-header">
            <h5 className="modal-title">{t("webhookExampleTitle")}</h5>
            <button
              className="btn-close"
              type="button"
              aria-label={t("close")}
              onClick={onClose}
            />
          </div>
          <div className="modal-body">
            <p className="text-secondary">{t("webhookExampleHelp")}</p>
            <pre className="mb-0 border rounded">
              <code
                className="hljs language-python"
                dangerouslySetInnerHTML={{ __html: highlighted }}
              />
            </pre>
          </div>
          <div className="modal-footer">
            <button
              className="btn btn-primary"
              type="button"
              onClick={download}
            >
              <i className="bi bi-download me-1" />
              {t("download")} {fileName}
            </button>
            <button
              className="btn btn-secondary"
              type="button"
              onClick={onClose}
            >
              {t("close")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
