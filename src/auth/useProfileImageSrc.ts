import { useEffect, useState } from "react";
import { apiRequestBlob } from "../api/client";
import { useAuth } from "./AuthProvider";

/**
 * The current user's picture: the uploaded one, fetched with the token, or
 * the URL from their settings. Empty when there is neither.
 */
export function useProfileImageSrc() {
  const { currentUser, idToken } = useAuth();
  const [src, setSrc] = useState("");

  useEffect(() => {
    let objectUrl = "";
    let cancelled = false;

    const loadProfileImage = async () => {
      if (!currentUser) {
        setSrc("");
        return;
      }

      if (!currentUser.profileImage || !idToken) {
        setSrc(currentUser.settings?.profileImageUrl ?? "");
        return;
      }

      try {
        const blob = await apiRequestBlob("/me/profile-image", idToken);
        const nextObjectUrl = URL.createObjectURL(blob);
        if (cancelled) {
          URL.revokeObjectURL(nextObjectUrl);
          return;
        }

        objectUrl = nextObjectUrl;
        setSrc(objectUrl);
      } catch {
        if (!cancelled) {
          setSrc(currentUser.settings?.profileImageUrl ?? "");
        }
      }
    };

    void loadProfileImage();

    return () => {
      cancelled = true;
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [
    currentUser,
    currentUser?.profileImage?.updatedAt,
    currentUser?.settings?.profileImageUrl,
    idToken,
  ]);

  return src;
}
