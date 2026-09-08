import { apiRequestBlob } from "./client";

/**
 * Uploaded avatars are fetched through an authenticated request, so they
 * cannot be used as a plain `src`. The resulting object URL is shared by
 * every avatar of the same user and kept for the life of the session:
 * revoking it on unmount would blank the copies still on screen, and the set
 * is bounded by the number of people taking part in the reviews on display.
 */
const avatarObjectUrls = new Map<string, Promise<string>>();

export function loadUserAvatar(
  userId: string,
  token: string,
): Promise<string> {
  const cached = avatarObjectUrls.get(userId);
  if (cached) {
    return cached;
  }

  const pending = apiRequestBlob(
    `/v1/users/${userId}/profile-image`,
    token,
  ).then((blob) => URL.createObjectURL(blob));

  // A failed fetch is not cached, otherwise a transient error would keep the
  // avatar missing until the page is reloaded.
  avatarObjectUrls.set(userId, pending);
  pending.catch(() => avatarObjectUrls.delete(userId));

  return pending;
}
