import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useI18n } from "../i18n/I18nProvider";

type ConfirmOptions = {
  title: string;
  message: string;
  confirmLabel: string;
  /** Destructive actions get a red button and a trash mark. */
  danger?: boolean;
};

type PendingConfirm = ConfirmOptions & {
  resolve: (confirmed: boolean) => void;
  /** Where focus was when the dialog opened, to hand it back on close. */
  returnFocus: HTMLElement | null;
};

type ConfirmContextValue = {
  /** The app's own `window.confirm`: resolves true only on the confirm button. */
  confirm: (options: ConfirmOptions) => Promise<boolean>;
};

const ConfirmContext = createContext<ConfirmContextValue | null>(null);

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const { t } = useI18n();
  const [pending, setPending] = useState<PendingConfirm | null>(null);
  const pendingRef = useRef<PendingConfirm | null>(null);

  const confirm = useCallback(
    (options: ConfirmOptions) =>
      new Promise<boolean>((resolve) => {
        // A second request replaces the first, which counts as cancelled.
        pendingRef.current?.resolve(false);
        const next: PendingConfirm = {
          ...options,
          resolve,
          returnFocus:
            document.activeElement instanceof HTMLElement
              ? document.activeElement
              : null,
        };
        pendingRef.current = next;
        setPending(next);
      }),
    [],
  );

  const settle = useCallback((confirmed: boolean) => {
    const current = pendingRef.current;
    if (!current) {
      return;
    }
    pendingRef.current = null;
    setPending(null);
    current.resolve(confirmed);
    if (current.returnFocus?.isConnected) {
      current.returnFocus.focus();
    }
  }, []);

  useEffect(() => {
    if (!pending) {
      return;
    }
    const cancelOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        settle(false);
      }
    };
    window.addEventListener("keydown", cancelOnEscape);
    return () => window.removeEventListener("keydown", cancelOnEscape);
  }, [pending, settle]);

  const value = useMemo(() => ({ confirm }), [confirm]);

  return (
    <ConfirmContext.Provider value={value}>
      {children}
      {pending ? (
        <>
          <div
            aria-describedby="confirm-dialog-message"
            aria-labelledby="confirm-dialog-title"
            aria-modal="true"
            className="modal d-block"
            role="alertdialog"
            onClick={(event) => {
              if (event.target === event.currentTarget) {
                settle(false);
              }
            }}
          >
            <div className="modal-dialog modal-dialog-centered">
              <div className="modal-content">
                <div className="modal-header align-items-center">
                  {pending.danger ? (
                    <span className="confirm-dialog-icon" aria-hidden="true">
                      <i className="bi bi-trash" />
                    </span>
                  ) : null}
                  <h5
                    className="modal-title flex-grow-1"
                    id="confirm-dialog-title"
                  >
                    {pending.title}
                  </h5>
                  <button
                    aria-label={t("close")}
                    className="btn-close"
                    type="button"
                    onClick={() => settle(false)}
                  />
                </div>
                <div className="modal-body">
                  <p className="mb-0" id="confirm-dialog-message">
                    {pending.message}
                  </p>
                </div>
                <div className="modal-footer">
                  {/* Cancel holds focus: Enter must never destroy by accident. */}
                  <button
                    autoFocus
                    className="btn btn-secondary"
                    type="button"
                    onClick={() => settle(false)}
                  >
                    {t("cancel")}
                  </button>
                  <button
                    className={`btn ${
                      pending.danger ? "btn-danger" : "btn-primary"
                    } d-inline-flex align-items-center gap-2`}
                    type="button"
                    onClick={() => settle(true)}
                  >
                    {pending.danger ? (
                      <i className="bi bi-trash" aria-hidden="true" />
                    ) : null}
                    {pending.confirmLabel}
                  </button>
                </div>
              </div>
            </div>
          </div>
          <div className="modal-backdrop show" />
        </>
      ) : null}
    </ConfirmContext.Provider>
  );
}

export function useConfirm() {
  const context = useContext(ConfirmContext);
  if (!context) {
    throw new Error("useConfirm must be used inside ConfirmProvider");
  }

  return context.confirm;
}
