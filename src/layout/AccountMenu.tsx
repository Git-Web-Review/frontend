import type { RefObject } from "react";
import { NavLink } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";
import { useProfileImageSrc } from "../auth/useProfileImageSrc";
import { useI18n } from "../i18n/I18nProvider";
import { profileInitialsFromEmail } from "../utils/profileInitials";
import { useTheme } from "./ThemeProvider";

/** The avatar in the header and its menu: theme, language, pages, logout. */
export function AccountMenu({
  open,
  onToggle,
  onClose,
  menuRef,
}: {
  open: boolean;
  onToggle: () => void;
  onClose: () => void;
  menuRef: RefObject<HTMLDivElement | null>;
}) {
  const { currentUser, signOutUser } = useAuth();
  const { language, setLanguage, t } = useI18n();
  const { theme, setTheme } = useTheme();
  const profileImageSrc = useProfileImageSrc();
  const accountLabel =
    currentUser?.settings?.nickname || currentUser?.email || "";

  return (
    <div className="account-menu" ref={menuRef}>
      <button
        className="account-menu-toggle"
        type="button"
        aria-expanded={open}
        aria-haspopup="true"
        title={accountLabel}
        onClick={onToggle}
      >
        <span className="account-avatar">
          {profileImageSrc ? (
            <img alt="" src={profileImageSrc} />
          ) : (
            profileInitialsFromEmail(currentUser?.email)
          )}
        </span>
        <i
          className="bi bi-chevron-down account-menu-caret"
          aria-hidden="true"
        />
      </button>
      {open ? (
        <div className="dropdown-menu show account-dropdown">
          <div className="account-dropdown-header">
            <span className="account-dropdown-name">{accountLabel}</span>
            {currentUser?.hostname ? (
              <span className="account-dropdown-host">
                {currentUser.hostname}
              </span>
            ) : null}
          </div>
          <button
            className="dropdown-item account-dropdown-item"
            type="button"
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          >
            <i
              className={theme === "dark" ? "bi bi-sun" : "bi bi-moon"}
              aria-hidden="true"
            />
            <span>{theme === "dark" ? t("light") : t("dark")}</span>
          </button>
          <button
            className="dropdown-item account-dropdown-item"
            type="button"
            onClick={() => setLanguage(language === "fr" ? "en" : "fr")}
          >
            <i className="bi bi-translate" aria-hidden="true" />
            <span>{language === "fr" ? "English" : "Français"}</span>
          </button>
          <NavLink
            className="dropdown-item account-dropdown-item"
            to="/settings"
            onClick={onClose}
          >
            <i className="bi bi-gear" aria-hidden="true" />
            <span>{t("settings")}</span>
          </NavLink>
          {currentUser?.role === "ADMIN" ? (
            <NavLink
              className="dropdown-item account-dropdown-item"
              to="/admin"
              onClick={onClose}
            >
              <i className="bi bi-shield-lock" aria-hidden="true" />
              <span>{t("admin")}</span>
            </NavLink>
          ) : null}
          <div className="dropdown-divider" />
          <button
            className="dropdown-item account-dropdown-item"
            type="button"
            onClick={() => void signOutUser()}
          >
            <i className="bi bi-box-arrow-right" aria-hidden="true" />
            <span>{t("logout")}</span>
          </button>
        </div>
      ) : null}
    </div>
  );
}
