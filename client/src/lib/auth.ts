import { apiRequest } from "./queryClient";
import type { AppUserPublic } from "@shared/schema";

const TOKEN_KEY = "taxadvice_token";
const USER_KEY = "taxadvice_user";

// In-memory storage (localStorage blocked in sandbox, but works in Coolify)
let memoryToken: string | null = null;
let memoryUser: AppUserPublic | null = null;

export function getToken(): string | null {
  if (memoryToken) return memoryToken;
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function getUser(): AppUserPublic | null {
  if (memoryUser) return memoryUser;
  try {
    const data = localStorage.getItem(USER_KEY);
    return data ? JSON.parse(data) : null;
  } catch {
    return null;
  }
}

export function setAuth(token: string, user: AppUserPublic): void {
  memoryToken = token;
  memoryUser = user;
  try {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  } catch {}
}

export function clearAuth(): void {
  memoryToken = null;
  memoryUser = null;
  try {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  } catch {}
}

export function isAuthenticated(): boolean {
  return !!getToken();
}

export function isAdmin(): boolean {
  const user = getUser();
  return user?.role === "admin";
}

// Authenticated fetch helper
export async function authFetch(url: string, options?: RequestInit): Promise<Response> {
  const token = getToken();
  const headers: Record<string, string> = {
    ...(options?.headers as Record<string, string> || {}),
  };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  if (options?.body && typeof options.body === "string") {
    headers["Content-Type"] = "application/json";
  }

  const API_BASE = "__PORT_5000__".startsWith("__") ? "" : "__PORT_5000__";
  const res = await fetch(`${API_BASE}${url}`, { ...options, headers });

  if (res.status === 401) {
    clearAuth();
    window.location.hash = "#/login";
    throw new Error("Phiên đăng nhập đã hết hạn");
  }

  return res;
}

// SSE streaming fetch for AI endpoints
export function streamFetch(
  url: string,
  body: any,
  onChunk: (text: string) => void,
  onDone: (output: any) => void,
  onError: (msg: string) => void,
  onSources?: (sources: string[]) => void
) {
  const token = getToken();
  const API_BASE = "__PORT_5000__".startsWith("__") ? "" : "__PORT_5000__";

  fetch(`${API_BASE}${url}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  }).then(async (res) => {
    if (!res.ok) {
      const data = await res.json().catch(() => ({ message: "Lỗi không xác định" }));
      onError(data.message);
      return;
    }

    const reader = res.body?.getReader();
    if (!reader) {
      onError("Không thể đọc response stream");
      return;
    }

    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        if (line.startsWith("data: ")) {
          try {
            const data = JSON.parse(line.slice(6));
            if (data.type === "chunk") {
              onChunk(data.text);
            } else if (data.type === "done") {
              onDone(data.output);
            } else if (data.type === "error") {
              onError(data.message);
            } else if (data.type === "sources" && onSources) {
              onSources(data.sources);
            }
          } catch {}
        }
      }
    }
  }).catch(err => {
    onError(err.message || "Lỗi kết nối");
  });
}
