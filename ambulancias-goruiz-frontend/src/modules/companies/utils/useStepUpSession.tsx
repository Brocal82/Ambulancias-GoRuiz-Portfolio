import { useRef, useState } from "react";
import { issueSuperadminStepUpSession } from "../../users/domain/api";
import { getApiErrorMessage, toastT } from "../../../utils/toast";

const STORAGE_KEY = "superadmin_step_up_session";

type PendingRequest = {
  resolve: (token: string | null) => void;
  reason: string;
};

type StoredSession = {
  token: string;
  expiresAt: string;
};

function readValidStoredToken(): string | null {
  const raw = sessionStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as StoredSession;
    if (!parsed?.token || !parsed?.expiresAt) {
      sessionStorage.removeItem(STORAGE_KEY);
      return null;
    }
    if (Date.now() >= new Date(parsed.expiresAt).getTime()) {
      sessionStorage.removeItem(STORAGE_KEY);
      return null;
    }
    return parsed.token;
  } catch {
    sessionStorage.removeItem(STORAGE_KEY);
    return null;
  }
}

export function useStepUpSession() {
  const pendingRef = useRef<PendingRequest | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [code, setCode] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const requestStepUpToken = (nextReason: string): Promise<string | null> => {
    const existing = readValidStoredToken();
    if (existing) return Promise.resolve(existing);

    return new Promise((resolve) => {
      pendingRef.current = { resolve, reason: nextReason };
      setReason(nextReason);
      setCode("");
      setIsOpen(true);
    });
  };

  const closeModal = () => {
    setIsOpen(false);
    const pending = pendingRef.current;
    pendingRef.current = null;
    if (pending) pending.resolve(null);
  };

  const confirm = async () => {
    setSubmitting(true);
    try {
      const data = await issueSuperadminStepUpSession(code.trim());
      sessionStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ token: data.stepUpToken, expiresAt: data.expiresAt } satisfies StoredSession),
      );
      setIsOpen(false);
      const pending = pendingRef.current;
      pendingRef.current = null;
      if (pending) pending.resolve(data.stepUpToken);
    } catch (err: unknown) {
      toastT.error(getApiErrorMessage(err, "No se pudo validar MFA para acción crítica."));
    } finally {
      setSubmitting(false);
    }
  };

  const modal = isOpen ? (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-5">
        <h3 className="text-lg font-semibold text-slate-900">Verificación MFA requerida</h3>
        <p className="mt-2 text-sm text-slate-600">{reason}</p>
        <input
          type="text"
          inputMode="numeric"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="Código de 6 dígitos"
          className="mt-4 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          autoFocus
        />
        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={closeModal}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
            disabled={submitting}
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={() => void confirm()}
            className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
            disabled={submitting}
          >
            {submitting ? "Validando..." : "Confirmar"}
          </button>
        </div>
      </div>
    </div>
  ) : null;

  return { requestStepUpToken, stepUpModal: modal };
}
