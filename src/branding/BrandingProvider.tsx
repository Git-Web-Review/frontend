import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { apiRequest, apiRequestBlob } from "../api/client";
import { useAuth } from "../auth/AuthProvider";
import type { Branding } from "../types/api";

type BrandingContextValue = {
  /** Custom name set by the admins, or null when the default name applies. */
  appName: string | null;
  /** Object URL of the uploaded logo, empty when there is none. */
  logoSrc: string;
  reloadBranding: () => Promise<void>;
};

const BrandingContext = createContext<BrandingContextValue | null>(null);

/**
 * Customer branding for the top bar. The logo is served behind the auth
 * guard, so it cannot be used as a plain `src` and is fetched as a blob like
 * the profile images.
 */
export function BrandingProvider({ children }: { children: ReactNode }) {
  const { idToken } = useAuth();
  const [branding, setBranding] = useState<Branding | null>(null);
  const [logoSrc, setLogoSrc] = useState("");

  const reloadBranding = useCallback(async () => {
    if (!idToken) {
      setBranding(null);
      return;
    }

    try {
      setBranding(await apiRequest<Branding>("/v1/branding", idToken));
    } catch {
      setBranding(null);
    }
  }, [idToken]);

  useEffect(() => {
    void reloadBranding();
  }, [reloadBranding]);

  const logoUpdatedAt = branding?.logo?.updatedAt ?? "";

  useEffect(() => {
    let objectUrl = "";
    let cancelled = false;

    const loadLogo = async () => {
      if (!logoUpdatedAt || !idToken) {
        setLogoSrc("");
        return;
      }

      try {
        const blob = await apiRequestBlob("/v1/branding/logo", idToken);
        const nextObjectUrl = URL.createObjectURL(blob);
        if (cancelled) {
          URL.revokeObjectURL(nextObjectUrl);
          return;
        }

        objectUrl = nextObjectUrl;
        setLogoSrc(objectUrl);
      } catch {
        if (!cancelled) {
          setLogoSrc("");
        }
      }
    };

    void loadLogo();

    return () => {
      cancelled = true;
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [idToken, logoUpdatedAt]);

  return (
    <BrandingContext.Provider
      value={{
        appName: branding?.appName ?? null,
        logoSrc,
        reloadBranding,
      }}
    >
      {children}
    </BrandingContext.Provider>
  );
}

export function useBranding() {
  const context = useContext(BrandingContext);
  if (!context) {
    throw new Error("useBranding must be used inside BrandingProvider");
  }

  return context;
}
