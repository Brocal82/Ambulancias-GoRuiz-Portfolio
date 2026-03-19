// src/utils/toast.ts
import i18next from "i18next";
import { toast as rawToast } from "react-toastify";
import type { ToastOptions } from "react-toastify";

// Tupla i18n: admite readonly para poder usar `as const`
export type I18nTuple = readonly [
  key: string,
  params?: Record<string, unknown>,
];
export type Msg = string | I18nTuple;

// Helper para crear tuplas i18n de forma cómoda
export const k = (key: string, params?: Record<string, unknown>): I18nTuple =>
  [key, params] as const;

// Resuelve un Msg (string o tupla i18n) a string traducido
export function resolveMessage(msg: Msg): string {
  if (typeof msg === "string") return msg;
  const [key, params] = msg;
  const translated = i18next.t(key, params);
  return translated || key;
}

// Opciones por defecto (puedes ajustarlas a tu gusto)
const DEFAULT_OPTS: ToastOptions = {
  position: "top-right",
  autoClose: 3000,
  closeOnClick: true,
  pauseOnHover: true,
  draggable: true,
};

// Merge de opciones con las por defecto
const withDefaults = (opts?: ToastOptions): ToastOptions => ({
  ...DEFAULT_OPTS,
  ...(opts ?? {}),
});

/**
 * Extrae mensaje de error de forma consistente.
 * Soporta: axios (response.data.message), Error.message, objetos con message/error.
 * Reutilizable en catch blocks y para setError en formularios.
 */
export function getApiErrorMessage(
  err: unknown,
  fallback: Msg = "Ha ocurrido un error",
): string {
  if (typeof err === "string") return err;
  if (err && typeof err === "object") {
    const ax = err as { response?: { data?: { message?: unknown } } };
    if (typeof ax?.response?.data?.message === "string")
      return ax.response.data.message;
    const anyErr = err as { message?: unknown; error?: unknown };
    if (typeof anyErr.message === "string") return anyErr.message;
    if (typeof anyErr.error === "string") return anyErr.error;
  }
  return resolveMessage(fallback);
}

// Normaliza errores desconocidos a un string presentable (usa getApiErrorMessage)
function normalizeErrorMessage(
  err: unknown,
  fallback: Msg = "Ha ocurrido un error",
): string {
  return getApiErrorMessage(err, fallback);
}

export const toastT = {
  success: (msg: Msg, opts?: ToastOptions) =>
    rawToast.success(resolveMessage(msg), withDefaults(opts)),

  error: (msg: Msg, opts?: ToastOptions) =>
    rawToast.error(resolveMessage(msg), withDefaults(opts)),

  warn: (msg: Msg, opts?: ToastOptions) =>
    rawToast.warn(resolveMessage(msg), withDefaults(opts)),

  info: (msg: Msg, opts?: ToastOptions) =>
    rawToast.info(resolveMessage(msg), withDefaults(opts)),

  // Helper i18n-friendly para toast.promise
  promise: <T>(
    p: Promise<T>,
    messages: {
      pending: Msg;
      success: Msg;
      error: Msg;
    },
    opts?: ToastOptions,
  ) =>
    rawToast.promise(
      p,
      {
        pending: resolveMessage(messages.pending),
        success: resolveMessage(messages.success),
        error: resolveMessage(messages.error),
      },
      withDefaults(opts),
    ),

  // Facilita toastear errores desconocidos (try/catch)
  fromError: (err: unknown, opts?: ToastOptions) =>
    rawToast.error(normalizeErrorMessage(err), withDefaults(opts)),

  /**
   * Toast de error a partir de un error de API.
   * Muestra response.data.message si existe, sino el fallback (i18n o string).
   */
  apiError: (err: unknown, fallback?: Msg, opts?: ToastOptions) =>
    rawToast.error(
      getApiErrorMessage(err, fallback ?? "Ha ocurrido un error"),
      withDefaults(opts),
    ),
};
