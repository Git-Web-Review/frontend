import axios, {
  AxiosError,
  type AxiosResponse,
  type InternalAxiosRequestConfig,
} from "axios";
import type { ApiError } from "../types/api";
import { firebaseAuth } from "../auth/firebase";

const backendUrl = import.meta.env.VITE_BACKEND_URL || "http://localhost:3005";

export class ApiClientError extends Error {
  constructor(
    public readonly status: number,
    public readonly apiError: ApiError,
  ) {
    super(apiError.message);
  }
}

type RetriableConfig = InternalAxiosRequestConfig & {
  tokenRetried?: boolean;
};

const httpClient = axios.create({ baseURL: backendUrl });

// Expired/invalid Firebase token: force-refresh it and replay the
// request once, through a response interceptor.
httpClient.interceptors.response.use(undefined, async (error: unknown) => {
  if (!(error instanceof AxiosError)) {
    throw error;
  }

  const config = error.config as RetriableConfig | undefined;
  if (
    error.response?.status !== 401 ||
    !config ||
    config.tokenRetried ||
    !firebaseAuth?.currentUser
  ) {
    throw error;
  }

  const freshToken = await firebaseAuth.currentUser
    .getIdToken(true)
    .catch(() => null);
  if (!freshToken) {
    throw error;
  }

  config.tokenRetried = true;
  config.headers.set("authorization", `Bearer ${freshToken}`);
  return httpClient.request(config);
});

function toApiClientError(error: unknown): ApiClientError {
  if (error instanceof AxiosError && error.response) {
    const fallback: ApiError = {
      code: "UNKNOWN_ERROR",
      message: error.response.statusText || error.message || "Request failed",
    };
    const data = error.response.data;
    const apiError =
      data && typeof data === "object" && "message" in data
        ? (data as ApiError)
        : fallback;
    return new ApiClientError(error.response.status, apiError);
  }

  const message = error instanceof Error ? error.message : "Request failed";
  return new ApiClientError(0, { code: "UNKNOWN_ERROR", message });
}

async function doRequest(
  path: string,
  token: string,
  init: RequestInit,
  responseType?: "blob",
): Promise<AxiosResponse<unknown>> {
  const headers: Record<string, string> = {
    authorization: `Bearer ${token}`,
  };
  for (const [name, value] of new Headers(init.headers).entries()) {
    headers[name] = value;
  }
  if (!(init.body instanceof FormData) && !headers["content-type"]) {
    headers["content-type"] = "application/json";
  }

  try {
    return await httpClient.request({
      url: path,
      method: (init.method ?? "GET").toLowerCase(),
      headers,
      data: init.body ?? undefined,
      responseType,
    });
  } catch (error) {
    throw toApiClientError(error);
  }
}

export async function apiRequest<T>(
  path: string,
  token: string,
  init: RequestInit = {},
): Promise<T> {
  const response = await doRequest(path, token, init);
  return response.data as T;
}

export async function apiRequestBlob(
  path: string,
  token: string,
): Promise<Blob> {
  const response = await doRequest(path, token, {}, "blob");
  return response.data as Blob;
}

export { backendUrl };
