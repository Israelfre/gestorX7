import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

// Interceptor global: adiciona X-Auth-Token e BASE_URL em todos os fetches para /api/*
const TOKEN_KEY = "gx7_token";
const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";
const _originalFetch = window.fetch.bind(window);

window.fetch = function (input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> {
  let url = typeof input === "string" ? input : input instanceof URL ? input.href : (input as Request).url;

  // Adiciona o prefixo BASE_URL para URLs que começam com /api/ (sem host)
  if (typeof url === "string" && url.startsWith("/api/") && BASE) {
    url = BASE + url;
  }

  // Adiciona o header X-Auth-Token para requests de API
  if (typeof url === "string" && url.includes("/api/")) {
    const token = localStorage.getItem(TOKEN_KEY);
    if (token) {
      const headers = new Headers(init.headers);
      if (!headers.has("x-auth-token")) {
        headers.set("x-auth-token", token);
      }
      init = { ...init, headers };
    }
  }

  return _originalFetch(typeof input === "string" ? url : input, init);
};

createRoot(document.getElementById("root")!).render(<App />);
