import type { ApiError } from "../types/api";

const backendUrl = import.meta.env.VITE_BACKEND_URL || "http://localhost:3005";

export class ApiClientError extends Error {
  constructor(
    public readonly status: number,
    public readonly apiError: ApiError,
  ) {
    super(apiError.message);
  }
}

export async function apiRequest<T>(
  path: string,
  token: string,
  init: RequestInit = {},
): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set("authorization", `Bearer ${token}`);

  if (!(init.body instanceof FormData)) {
    headers.set("content-type", "application/json");
  }

  const response = await fetch(`${backendUrl}${path}`, {
    ...init,
    headers,
  });

  if (!response.ok) {
    const fallback: ApiError = {
      code: "UNKNOWN_ERROR",
      message: response.statusText || "Request failed",
    };
    const apiError = (await response.json().catch(() => fallback)) as ApiError;
    throw new ApiClientError(response.status, apiError);
  }

  return (await response.json()) as T;
}

export { backendUrl };
