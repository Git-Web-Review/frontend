export const profileInitialsFromEmail = (email?: string | null) => {
  const localPart = email?.split("@")[0]?.trim() ?? "";
  const parts = localPart.split(/[^a-zA-Z0-9]+/).filter(Boolean);

  const initials =
    parts.length >= 2
      ? `${parts[0][0]}${parts[1][0]}`
      : localPart.replace(/[^a-zA-Z0-9]/g, "").slice(0, 2);

  return initials ? initials.toUpperCase() : "GW";
};
