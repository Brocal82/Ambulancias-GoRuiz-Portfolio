import { ENV } from "../config/env";
import { ApiErrorPayload } from "../types/auth";

const DEFAULT_TIMEOUT_MS = 12000;

type AuthHandlers = {
  getToken: () => Promise<string | null> | string | null;
  onUnauthorized: () => Promise<void> | void;
};

let authHandlers: AuthHandlers | null = null;

export class ApiError extends Error {
  status: number;
  code?: string;

  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }
}

type RequestConfig = RequestInit & {
  timeoutMs?: number;
  requiresAuth?: boolean;
};

export function setApiAuthHandlers(handlers: AuthHandlers | null): void {
  authHandlers = handlers;
}

export async function apiRequest<TResponse>(
  endpoint: string,
  config: RequestConfig = {},
): Promise<TResponse> {
  const controller = new AbortController();
  const timeoutId = setTimeout(
    () => controller.abort(),
    config.timeoutMs ?? DEFAULT_TIMEOUT_MS,
  );

  try {
    const token =
      config.requiresAuth && authHandlers
        ? await authHandlers.getToken()
        : null;

    const response = await fetch(`${ENV.apiBaseUrl}${endpoint}`, {
      ...config,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(config.headers ?? {}),
      },
      signal: controller.signal,
    });

    const data = (await response.json().catch(() => null)) as
      | TResponse
      | ApiErrorPayload
      | null;

    if (!response.ok) {
      const payload = (data ?? {}) as ApiErrorPayload;
      if (response.status === 401 && authHandlers) {
        await authHandlers.onUnauthorized();
      }
      throw new ApiError(
        payload.message ?? "Error de red o servidor.",
        response.status,
        payload.code,
      );
    }

    return data as TResponse;
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    if (error instanceof Error && error.name === "AbortError") {
      throw new ApiError("La peticion ha tardado demasiado.", 408);
    }
    throw new ApiError("No se pudo conectar con el servidor.", 0);
  } finally {
    clearTimeout(timeoutId);
  }
}
