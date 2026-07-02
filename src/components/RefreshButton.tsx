import { useI18n } from "../i18n/I18nProvider";

type RefreshButtonProps = {
  loading: boolean;
  disabled?: boolean;
  onClick: () => void;
};

export function RefreshButton({
  loading,
  disabled = false,
  onClick,
}: RefreshButtonProps) {
  const { t } = useI18n();

  return (
    <button
      className="btn btn-outline-secondary btn-sm d-inline-flex align-items-center gap-2"
      type="button"
      disabled={loading || disabled}
      onClick={onClick}
    >
      {loading ? (
        <span className="spinner-border spinner-border-sm" />
      ) : (
        <i className="bi bi-arrow-clockwise" aria-hidden="true" />
      )}
      {t("refresh")}
    </button>
  );
}
