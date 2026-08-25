import { useI18n } from "../../i18n/I18nProvider";

type ReviewerActionSplitProps = {
  menuOpen: boolean;
  setMenuOpen: (open: boolean) => void;
  saving: boolean;
  canAck: boolean;
  canReviewDone: boolean;
  preferReviewDone: boolean;
  ackLabel: string;
  onAck: () => void;
  onReviewDone: () => void;
  small?: boolean;
};

export function ReviewerActionSplit(options: ReviewerActionSplitProps) {
  const { t } = useI18n();
  const reviewDoneAction = options.canReviewDone
    ? {
        label: t("reviewDone"),
        icon: "bi-clipboard-check",
        onClick: options.onReviewDone,
      }
    : null;
  const ackAction = options.canAck
    ? {
        label: options.ackLabel,
        icon: "bi-check2-circle",
        onClick: options.onAck,
      }
    : null;
  const primary =
    options.preferReviewDone && reviewDoneAction
      ? reviewDoneAction
      : (ackAction ?? reviewDoneAction);
  if (!primary) {
    return null;
  }
  const secondaryActions = [reviewDoneAction, ackAction].filter(
    (action): action is NonNullable<typeof action> =>
      !!action && action !== primary,
  );
  const sizeClass = options.small ? " btn-sm" : "";

  return (
    <div className="btn-group review-action-group flex-shrink-0">
      <button
        className={`btn btn-success${sizeClass} d-inline-flex align-items-center gap-2`}
        disabled={options.saving}
        type="button"
        onClick={() => {
          options.setMenuOpen(false);
          primary.onClick();
        }}
      >
        {options.saving ? (
          <span className="spinner-border spinner-border-sm" />
        ) : (
          <i className={`bi ${primary.icon}`} aria-hidden="true" />
        )}
        {primary.label}
      </button>
      {secondaryActions.length ? (
        <>
          <button
            aria-expanded={options.menuOpen}
            className={`btn btn-success${sizeClass} dropdown-toggle dropdown-toggle-split`}
            disabled={options.saving}
            type="button"
            onClick={() => options.setMenuOpen(!options.menuOpen)}
          >
            <span className="visually-hidden">{t("moreActions")}</span>
          </button>
          <ul
            className={`dropdown-menu dropdown-menu-end review-action-menu${
              options.menuOpen ? " show" : ""
            }`}
          >
            {secondaryActions.map((action) => (
              <li key={action.label}>
                <button
                  className="dropdown-item d-flex align-items-center gap-2"
                  type="button"
                  onClick={() => {
                    options.setMenuOpen(false);
                    action.onClick();
                  }}
                >
                  <i className={`bi ${action.icon}`} aria-hidden="true" />
                  {action.label}
                </button>
              </li>
            ))}
          </ul>
        </>
      ) : null}
    </div>
  );
}
