const TOKEN_KEY = "gx7_token";

export function getToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function authFetch(input: string, init: RequestInit = {}): Promise<Response> {
  const token = getToken();
  const headers: Record<string, string> = {
    ...(init.headers as Record<string, string> | undefined),
    ...(token ? { "X-Auth-Token": token } : {}),
  };
  return fetch(input, { ...init, headers, credentials: "include" });
}
