import { useEffect, useState } from "react";
import { loadUserAvatar } from "../api/userAvatars";
import type { ReviewUserSummary } from "../types/api";
import { profileInitialsFromEmail } from "../utils/profileInitials";

type UserAvatarProps = {
  user: ReviewUserSummary;
  idToken: string | null;
  className?: string;
};

/**
 * Avatar for someone other than the current user. An uploaded image wins over
 * the external URL from their settings, and initials stand in when there is
 * neither. Decorative: every call site shows the name right next to it.
 */
export function UserAvatar({ user, idToken, className }: UserAvatarProps) {
  const [imageSrc, setImageSrc] = useState(user.profileImageUrl ?? "");

  useEffect(() => {
    let cancelled = false;
    setImageSrc(user.profileImageUrl ?? "");

    if (!user.hasProfileImage || !idToken) {
      return;
    }

    loadUserAvatar(user.id, idToken)
      .then((objectUrl) => {
        if (!cancelled) {
          setImageSrc(objectUrl);
        }
      })
      .catch(() => undefined);

    return () => {
      cancelled = true;
    };
  }, [idToken, user.hasProfileImage, user.id, user.profileImageUrl]);

  return (
    <span
      aria-hidden="true"
      className={className ? `user-avatar ${className}` : "user-avatar"}
    >
      {imageSrc ? (
        <img alt="" src={imageSrc} onError={() => setImageSrc("")} />
      ) : (
        profileInitialsFromEmail(user.email)
      )}
    </span>
  );
}
