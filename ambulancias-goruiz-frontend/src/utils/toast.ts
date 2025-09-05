// Wrapper de react-toastify que acepta claves i18n o textos planos.
// Permite migración gradual: puedes pasar un string normal o ["clave.i18n", {vars}]
import i18next from "i18next";
import { toast as rawToast } from "react-toastify";
import type { ToastOptions } from "react-toastify";

type I18nTuple = [key: string, params?: Record<string, unknown>];
type Msg = string | I18nTuple;

function resolveMessage(msg: Msg): string {
  if (Array.isArray(msg)) {
    const [key, params] = msg;
    // Si la clave no existe, devuelve la propia clave para facilitar debugging
    const translated = i18next.t(key, params);
    return translated || key;
  }
  return msg;
}

export const toastT = {
  success: (msg: Msg, opts?: ToastOptions) =>
    rawToast.success(resolveMessage(msg), opts),
  error: (msg: Msg, opts?: ToastOptions) =>
    rawToast.error(resolveMessage(msg), opts),
  warn: (msg: Msg, opts?: ToastOptions) =>
    rawToast.warn(resolveMessage(msg), opts),
  info: (msg: Msg, opts?: ToastOptions) =>
    rawToast.info(resolveMessage(msg), opts),
};
