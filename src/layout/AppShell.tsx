import type { ReactNode, RefObject } from "react";
import { useEffect, useRef, useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { useBranding } from "../branding/BrandingProvider";
import { useI18n } from "../i18n/I18nProvider";
import { AccountMenu } from "./AccountMenu";
import { NotificationsMenu } from "./notifications/NotificationsMenu";
import { useNotifications } from "./notifications/useNotifications";

type AppShellProps = {
  children: ReactNode;
};

type AppView = "review" | "settings" | "admin" | "dashboard";

const viewFromPath = (pathname: string): AppView =>
  pathname.startsWith("/review")
    ? "review"
    : pathname.startsWith("/settings")
      ? "settings"
      : pathname.startsWith("/admin")
        ? "admin"
        : "dashboard";

const viewKickerKeys = {
  dashboard: "kickerReviews",
  review: "kickerReviewDetails",
  settings: "kickerAccount",
  admin: "kickerAdministration",
} as const;

const viewTitleKeys = {
  dashboard: "dashboard",
  review: "reviewDetails",
  settings: "settings",
  admin: "admin",
} as const;

/** Closes open header menus on a click outside them or on Escape. */
function useCloseMenusOnOutsideClick(
  anyOpen: boolean,
  menus: { ref: RefObject<HTMLElement | null>; close: () => void }[],
) {
  useEffect(() => {
    if (!anyOpen) {
      return;
    }

    const closeMenusOnOutsidePointerDown = (event: PointerEvent) => {
      const target = event.target instanceof Node ? event.target : null;

      for (const menu of menus) {
        if (!target || !menu.ref.current?.contains(target)) {
          menu.close();
        }
      }
    };

    const closeMenusOnEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") {
        return;
      }

      for (const menu of menus) {
        menu.close();
      }
    };

    document.addEventListener("pointerdown", closeMenusOnOutsidePointerDown);
    document.addEventListener("keydown", closeMenusOnEscape);
    return () => {
      document.removeEventListener(
        "pointerdown",
        closeMenusOnOutsidePointerDown,
      );
      document.removeEventListener("keydown", closeMenusOnEscape);
    };
  }, [anyOpen]);
}

export function AppShell({ children }: AppShellProps) {
  const { appName, logoSrc } = useBranding();
  const { t } = useI18n();
  const location = useLocation();
  const notificationsRef = useRef<HTMLLIElement | null>(null);
  const accountMenuRef = useRef<HTMLDivElement | null>(null);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const notifications = useNotifications();
  const activeView = viewFromPath(location.pathname);

  useCloseMenusOnOutsideClick(notificationsOpen || accountMenuOpen, [
    { ref: notificationsRef, close: () => setNotificationsOpen(false) },
    { ref: accountMenuRef, close: () => setAccountMenuOpen(false) },
  ]);

  return (
    <div className="app-wrapper">
      <nav className="app-header navbar navbar-expand bg-body">
        <div className="container-fluid">
          <NavLink className="app-brand" to="/dashboard">
            {logoSrc ? (
              <img alt="" className="app-brand-logo" src={logoSrc} />
            ) : null}
            <span className="app-brand-name">{appName || t("appName")}</span>
          </NavLink>
          <div className="app-header-end">
            <ul className="navbar-nav align-items-center">
              <NotificationsMenu
                notifications={notifications}
                open={notificationsOpen}
                setOpen={setNotificationsOpen}
                menuRef={notificationsRef}
              />
            </ul>
            <AccountMenu
              open={accountMenuOpen}
              onToggle={() => {
                setNotificationsOpen(false);
                setAccountMenuOpen((open) => !open);
              }}
              onClose={() => setAccountMenuOpen(false)}
              menuRef={accountMenuRef}
            />
          </div>
        </div>
      </nav>
      <main className="app-main" data-view={activeView}>
        <div className="app-content-header">
          <div className="container-fluid">
            <div className="row">
              <div className="col-sm-6">
                <span className="app-kicker">
                  {t(viewKickerKeys[activeView])}
                </span>
                <h3 className="mb-0">{t(viewTitleKeys[activeView])}</h3>
              </div>
            </div>
          </div>
        </div>
        <div className="app-content">
          <div className="container-fluid">{children}</div>
        </div>
      </main>
    </div>
  );
}
