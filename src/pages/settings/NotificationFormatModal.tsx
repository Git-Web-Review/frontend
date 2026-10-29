import {
  FORMAT_SPECIFIERS,
  formatSample,
} from "../../components/user-settings/notification-format";
import { useI18n } from "../../i18n/I18nProvider";
import { notificationTitleKeys } from "../../layout/notifications/notification-payloads";
import type {
  NotificationFormatMedium,
  NotificationFormats,
  NotificationType,
} from "../../types/api";
import { closeOnBackdrop } from "../../utils/closeOnBackdrop";

const NOTIFICATION_TYPES = Object.keys(
  notificationTitleKeys,
) as NotificationType[];

const renderedLines = (format: string) =>
  formatSample(format)
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

/** What the relay would send, with the same line handling. */
function FormatPreview({
  medium,
  format,
}: {
  medium: NotificationFormatMedium;
  format: string;
}) {
  const { t } = useI18n();
  const lines = renderedLines(format);

  if (lines.length === 0) {
    return (
      <span className="text-secondary fst-italic">
        {t("formatDefaultTemplate")}
      </span>
    );
  }

  if (medium === "irc") {
    return <span className="font-monospace">{lines.join(" - ")}</span>;
  }

  const [subject, ...body] = lines;
  return (
    <>
      <div className="fw-semibold">{subject}</div>
      {body.map((line, index) => (
        <div key={index}>{line}</div>
      ))}
    </>
  );
}

/** One printf-style format per notification type, previewed as typed. */
export function NotificationFormatModal({
  medium,
  formats,
  onChange,
  onClose,
}: {
  medium: NotificationFormatMedium;
  formats: NotificationFormats;
  onChange: (type: NotificationType, format: string) => void;
  onClose: () => void;
}) {
  const { t } = useI18n();

  return (
    <div
      className="modal fade show d-block"
      onMouseDown={closeOnBackdrop(onClose)}
      role="dialog"
      tabIndex={-1}
      style={{ backgroundColor: "rgba(0, 0, 0, 0.5)" }}
    >
      <div className="modal-dialog modal-dialog-centered modal-dialog-scrollable modal-xl">
        <div className="modal-content">
          <div className="modal-header">
            <h5 className="modal-title">
              {t(medium === "irc" ? "formatTitleIrc" : "formatTitleMail")}
            </h5>
            <button
              className="btn-close"
              type="button"
              aria-label={t("close")}
              onClick={onClose}
            />
          </div>
          <div className="modal-body">
            <p className="text-secondary mb-2">
              {t(medium === "irc" ? "formatHelpIrc" : "formatHelpMail")}
            </p>
            <div className="row row-cols-2 row-cols-md-3 g-1 small border rounded bg-body-tertiary p-2 mx-0 mb-4">
              {FORMAT_SPECIFIERS.map((specifier) => (
                <div className="col" key={specifier.key}>
                  <code>%{specifier.key}</code> {t(specifier.label)}
                </div>
              ))}
              <div className="col">
                <code>%%</code> {t("formatSpecPercent")}
              </div>
            </div>
            {NOTIFICATION_TYPES.map((type) => {
              const id = `format-${medium}-${type}`;
              const format = formats[medium]?.[type] ?? "";
              return (
                <div className="row g-3 mb-3" key={type}>
                  <div className="col-md-6">
                    <label className="form-label mb-1" htmlFor={id}>
                      {t(notificationTitleKeys[type])}
                    </label>
                    <textarea
                      className="form-control font-monospace"
                      id={id}
                      rows={2}
                      maxLength={500}
                      placeholder={t("formatDefaultTemplate")}
                      value={format}
                      onChange={(event) => onChange(type, event.target.value)}
                    />
                  </div>
                  <div className="col-md-6">
                    <div className="form-label mb-1 text-secondary">
                      {t("formatPreview")}
                    </div>
                    <div className="border rounded bg-body-tertiary px-3 py-2 small text-break">
                      <FormatPreview medium={medium} format={format} />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="modal-footer">
            <span className="text-secondary small me-auto">
              {t("formatSaveHint")}
            </span>
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
