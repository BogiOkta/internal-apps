"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  login as loginRequest,
  logout as logoutRequest,
  refreshSession,
} from "@/services/auth";
import type { CurrentUser, LoginCredentials } from "@/types/auth";

type AuthContextValue = {
  accessToken: string | null;
  user: CurrentUser | null;
  isLoading: boolean;
  login: (credentials: LoginCredentials) => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isActive = true;

    refreshSession()
      .then((session) => {
        if (!isActive || !session) {
          return;
        }

        setAccessToken(session.accessToken);
        setUser(session.user);
      })
      .catch(() => {
        if (isActive) {
          setAccessToken(null);
          setUser(null);
        }
      })
      .finally(() => {
        if (isActive) {
          setIsLoading(false);
        }
      });

    return () => {
      isActive = false;
    };
  }, []);

  const login = useCallback(async (credentials: LoginCredentials) => {
    const session = await loginRequest(credentials);
    setAccessToken(session.accessToken);
    setUser(session.user);
  }, []);

  const logout = useCallback(async () => {
    try {
      await logoutRequest(accessToken);
    } finally {
      setAccessToken(null);
      setUser(null);
    }
  }, [accessToken]);

  const value = useMemo(
    () => ({ accessToken, user, isLoading, login, logout }),
    [accessToken, user, isLoading, login, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used inside AuthProvider.");
  }

  return context;
}
