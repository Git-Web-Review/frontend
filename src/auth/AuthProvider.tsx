import {
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  type User as FirebaseUser,
} from "firebase/auth";
import { createContext, type ReactNode, useContext, useEffect, useState } from "react";
import { apiRequest, ApiClientError } from "../api/client";
import type { ApiError, CurrentUser } from "../types/api";
import { firebaseAuth, isFirebaseConfigured, oauthProvider } from "./firebase";

type AuthContextValue = {
  firebaseUser: FirebaseUser | null;
  currentUser: CurrentUser | null;
  idToken: string | null;
  loading: boolean;
  error: ApiError | null;
  signIn: () => Promise<void>;
  signOutUser: () => Promise<void>;
  refreshCurrentUser: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [idToken, setIdToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<ApiError | null>(null);

  const loadCurrentUser = async (user: FirebaseUser) => {
    const token = await user.getIdToken();
    setIdToken(token);
    const me = await apiRequest<CurrentUser>("/v1/me", token);
    setCurrentUser(me);
  };

  useEffect(() => {
    if (!firebaseAuth) {
      setLoading(false);
      return;
    }

    return onAuthStateChanged(firebaseAuth, (user) => {
      setFirebaseUser(user);
      setError(null);
      setLoading(true);

      if (!user) {
        setCurrentUser(null);
        setIdToken(null);
        setLoading(false);
        return;
      }

      void loadCurrentUser(user)
        .catch((unknownError: unknown) => {
          if (unknownError instanceof ApiClientError) {
            setError(unknownError.apiError);
          } else if (unknownError instanceof Error) {
            setError({ code: "UNKNOWN_ERROR", message: unknownError.message });
          }
          setCurrentUser(null);
        })
        .finally(() => setLoading(false));
    });
  }, []);

  const signIn = async () => {
    if (!firebaseAuth || !isFirebaseConfigured) {
      setError({ code: "UNKNOWN_ERROR", message: "Firebase is not configured" });
      return;
    }

    setError(null);
    await signInWithPopup(firebaseAuth, oauthProvider);
  };

  const signOutUser = async () => {
    if (firebaseAuth) {
      await signOut(firebaseAuth);
    }
    setCurrentUser(null);
    setIdToken(null);
  };

  const refreshCurrentUser = async () => {
    if (!firebaseUser) {
      return;
    }

    await loadCurrentUser(firebaseUser);
  };

  return (
    <AuthContext.Provider
      value={{
        firebaseUser,
        currentUser,
        idToken,
        loading,
        error,
        signIn,
        signOutUser,
        refreshCurrentUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used inside AuthProvider");
  }

  return context;
}