import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  confirmSuperadminMfaEnrollment,
  disableSuperadminMfa,
  getSuperadminMfaStatus,
  issueSuperadminStepUpSession,
  startSuperadminMfaEnrollment,
  type SuperadminMfaEnrollResponse,
  type SuperadminMfaStatusResponse,
} from "../domain/api";
import { getApiErrorMessage, toastT } from "../../../utils/toast";

const STEP_UP_STORAGE_KEY = "superadmin_step_up_session";

export default function SuperadminMfaSettingsPage() {
  const [status, setStatus] = useState<SuperadminMfaStatusResponse | null>(null);
  const [enrollment, setEnrollment] = useState<SuperadminMfaEnrollResponse | null>(null);
  const [setupCode, setSetupCode] = useState("");
  const [disableCode, setDisableCode] = useState("");
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);

  const loadStatus = async () => {
    setLoading(true);
    try {
      const data = await getSuperadminMfaStatus();
      setStatus(data);
    } catch (err: unknown) {
      toastT.error(getApiErrorMessage(err, "No se pudo cargar el estado MFA"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadStatus();
  }, []);

  const startEnrollment = async () => {
    setWorking(true);
    try {
      const data = await startSuperadminMfaEnrollment();
      setEnrollment(data);
      toastT.success("Se generó un secreto TOTP. Añádelo en tu app autenticadora.");
      await loadStatus();
    } catch (err: unknown) {
      toastT.error(getApiErrorMessage(err, "No se pudo iniciar el enrolamiento MFA"));
    } finally {
      setWorking(false);
    }
  };

  const confirmEnrollment = async () => {
    setWorking(true);
    try {
      const normalizedCode = setupCode.trim();
      await confirmSuperadminMfaEnrollment(normalizedCode);
      // Convenience UX: issue step-up session right after MFA activation so
      // critical superadmin flows can continue without an immediate second prompt.
      const stepUp = await issueSuperadminStepUpSession(normalizedCode);
      sessionStorage.setItem(
        STEP_UP_STORAGE_KEY,
        JSON.stringify({ token: stepUp.stepUpToken, expiresAt: stepUp.expiresAt }),
      );
      setSetupCode("");
      setEnrollment(null);
      toastT.success("MFA activado correctamente. Sesión step-up iniciada.");
      await loadStatus();
    } catch (err: unknown) {
      toastT.error(getApiErrorMessage(err, "Código inválido o enrolamiento incompleto"));
    } finally {
      setWorking(false);
    }
  };

  const disableMfa = async () => {
    setWorking(true);
    try {
      await disableSuperadminMfa(disableCode.trim());
      setDisableCode("");
      toastT.success("MFA desactivado.");
      await loadStatus();
    } catch (err: unknown) {
      toastT.error(getApiErrorMessage(err, "No se pudo desactivar MFA"));
    } finally {
      setWorking(false);
    }
  };

  return (
    <div className="p-4 max-w-3xl mx-auto space-y-4">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Seguridad MFA superadmin</h1>
          <p className="text-slate-600 mt-1">
            Configura TOTP para endurecer la autenticación de cuentas privilegiadas.
          </p>
        </div>
        <Link
          to="/superadmin"
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
        >
          Volver al panel
        </Link>
      </div>

      {loading ? (
        <div className="rounded-lg border border-slate-200 bg-white p-4 text-slate-600">
          Cargando estado MFA...
        </div>
      ) : (
        <div className="rounded-lg border border-slate-200 bg-white p-4 space-y-2">
          <p>
            <span className="font-medium">MFA requerido por entorno:</span>{" "}
            {status?.required ? "Sí" : "No"}
          </p>
          <p>
            <span className="font-medium">MFA activo:</span> {status?.enabled ? "Sí" : "No"}
          </p>
          <p>
            <span className="font-medium">Enrolamiento pendiente:</span>{" "}
            {status?.pendingSetup ? "Sí" : "No"}
          </p>
          {status?.enabled ? (
            <p className="rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
              MFA ya está activo. Para acciones críticas usa un código actual de tu autenticador (cambia cada 30 segundos).
            </p>
          ) : (
            <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">
              MFA aún no está activo. Completa el enrolamiento para proteger la cuenta superadmin.
            </p>
          )}
        </div>
      )}

      {!status?.enabled && (
        <div className="rounded-lg border border-slate-200 bg-white p-4 space-y-3">
          <h2 className="text-lg font-semibold text-slate-900">1) Iniciar enrolamiento</h2>
          <button
            type="button"
            onClick={() => void startEnrollment()}
            disabled={working}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
          >
            Generar secreto TOTP
          </button>
          {enrollment && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm space-y-2">
              <p>
                <span className="font-medium">Issuer:</span> {enrollment.issuer}
              </p>
              <p>
                <span className="font-medium">Cuenta:</span> {enrollment.label}
              </p>
              <p>
                <span className="font-medium">Secreto:</span>{" "}
                <code className="text-xs">{enrollment.secret}</code>
              </p>
              <p className="text-xs text-slate-700">
                También puedes usar el link otpauth en una app compatible:
              </p>
              <code className="block whitespace-pre-wrap break-all text-xs">
                {enrollment.otpauthUrl}
              </code>
            </div>
          )}
        </div>
      )}

      {!status?.enabled && (
        <div className="rounded-lg border border-slate-200 bg-white p-4 space-y-3">
          <h2 className="text-lg font-semibold text-slate-900">2) Confirmar MFA</h2>
          <p className="text-sm text-slate-600">
            Introduce un código vigente de tu autenticador. El código cambia cada 30 segundos.
          </p>
          <div className="flex gap-2 flex-wrap">
            <input
              type="text"
              inputMode="numeric"
              value={setupCode}
              onChange={(e) => setSetupCode(e.target.value)}
              placeholder="Código de 6 dígitos"
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm w-56"
            />
            <button
              type="button"
              onClick={() => void confirmEnrollment()}
              disabled={working}
              className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
            >
              Confirmar y activar
            </button>
          </div>
        </div>
      )}

      <div className="rounded-lg border border-rose-200 bg-rose-50 p-4 space-y-3">
        <h2 className="text-lg font-semibold text-rose-900">3) Desactivar MFA</h2>
        <p className="text-sm text-rose-800">
          Solo para recuperación controlada o cambio de autenticador.
        </p>
        <div className="flex gap-2 flex-wrap">
          <input
            type="text"
            inputMode="numeric"
            value={disableCode}
            onChange={(e) => setDisableCode(e.target.value)}
            placeholder="Código actual de 6 dígitos"
            className="rounded-lg border border-rose-300 px-3 py-2 text-sm w-56"
          />
          <button
            type="button"
            onClick={() => void disableMfa()}
            disabled={working}
            className="rounded-lg bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-700 disabled:opacity-60"
          >
            Desactivar MFA
          </button>
        </div>
      </div>
    </div>
  );
}
