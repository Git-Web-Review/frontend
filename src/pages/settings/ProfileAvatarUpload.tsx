import { useRef, useState } from "react";
import { apiRequest } from "../../api/client";
import { useAuth } from "../../auth/AuthProvider";
import { useProfileImageSrc } from "../../auth/useProfileImageSrc";
import { useI18n } from "../../i18n/I18nProvider";
import { useToast } from "../../layout/ToastProvider";
import type { UserProfileImage } from "../../types/api";
import { profileInitialsFromEmail } from "../../utils/profileInitials";

/** The profile picture, replaced by clicking it and picking a file. */
export function ProfileAvatarUpload() {
  const { currentUser, idToken, refreshCurrentUser } = useAuth();
  const { t } = useI18n();
  const { showToast } = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const profileImageSrc = useProfileImageSrc();

  const uploadProfileImage = async (file?: File) => {
    if (!idToken || !file) {
      return;
    }

    const body = new FormData();
    body.append("file", file);

    setUploading(true);
    try {
      await apiRequest<UserProfileImage>("/me/profile-image", idToken, {
        method: "PATCH",
        body,
      });
      await refreshCurrentUser();
      showToast(t("profileImageSaved"));
    } catch (error) {
      showToast(
        error instanceof Error ? error.message : t("backendError"),
        "danger",
      );
    } finally {
      setUploading(false);
      if (inputRef.current) {
        inputRef.current.value = "";
      }
    }
  };

  return (
    <div className="profile-avatar-panel">
      <button
        className="profile-avatar-button"
        type="button"
        disabled={uploading}
        onClick={() => inputRef.current?.click()}
      >
        {profileImageSrc ? (
          <img alt="" src={profileImageSrc} />
        ) : (
          <span>{profileInitialsFromEmail(currentUser?.email)}</span>
        )}
        <span className="profile-avatar-overlay">
          {uploading ? (
            <span className="spinner-border spinner-border-sm" />
          ) : (
            <i className="bi bi-camera" aria-hidden="true" />
          )}
        </span>
      </button>
      <input
        ref={inputRef}
        className="visually-hidden"
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif"
        onChange={(event) => void uploadProfileImage(event.target.files?.[0])}
      />
      <h3>{t("profile")}</h3>
    </div>
  );
}
