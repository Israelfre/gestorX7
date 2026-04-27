import { createContext, useContext, useEffect, useState, ReactNode } from "react";

export type AuthUser = {
  id: number;
  name: string;
  email: string;
  role: "admin" | "client";
  plan: string;
  planExpiresAt: string | null;
  tenantId: number;
  planExpired: boolean;
};

type AuthContextType = {
  user: AuthUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | null>(null);

const API = import.meta.env.BASE_URL.replace(/\/$/, "") + "/api";
const TOKEN_KEY = "gx7_token";

export function getAuthToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

function setAuthToken(token: string | null) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {}
}

function authHeaders(): HeadersInit {
  const token = getAuthToken();
  return token ? { "X-Auth-Token": token } : {};
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  async function refresh() {
    try {
      const res = await fetch(`${API}/auth/me`, {
        credentials: "include",
        cache: "no-store",
        headers: { ...authHeaders(), "Cache-Control": "no-cache" },
      });
      if (res.ok) {
        setUser(await res.json());
      } else {
        setUser(null);
      }
    } catch {
      setUser(null);
    }
  }

  useEffect(() => {
    refresh().finally(() => setLoading(false));
  }, []);

  async function login(email: string, password: string) {
    const res = await fetch(`${API}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ email, password }),
    });
    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error || "Erro ao fazer login");
    }
    const data = await res.json();
    // Salva o sessionId no localStorage para uso como fallback ao cookie
    if (data.sessionId) {
      setAuthToken(data.sessionId);
    }
    await refresh();
  }

  async function logout() {
    await fetch(`${API}/auth/logout`, {
      method: "POST",
      credentials: "include",
      headers: authHeaders(),
    });
    setAuthToken(null);
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, refresh }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
