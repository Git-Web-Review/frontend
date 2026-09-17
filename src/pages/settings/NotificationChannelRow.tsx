import type { ReactNode } from "react";

/** A notification switch, with the field it needs beside it once on. */
export function NotificationChannelRow({
  id,
  label,
  enabled,
  onEnabledChange,
  children,
}: {
  id: string;
  label: string;
  enabled: boolean;
  onEnabledChange: (enabled: boolean) => void;
  children: ReactNode;
}) {
  return (
    <div className="row g-3 mb-3">
      <div className="col-md-5">
        <div
          className={`form-check form-switch mb-0${
            enabled ? " irc-toggle-align" : ""
          }`}
        >
          <input
            className="form-check-input"
            id={id}
            type="checkbox"
            checked={enabled}
            onChange={(event) => onEnabledChange(event.target.checked)}
          />
          <label className="form-check-label" htmlFor={id}>
            {label}
          </label>
        </div>
      </div>
      {enabled ? <div className="col-md-7">{children}</div> : null}
    </div>
  );
}
