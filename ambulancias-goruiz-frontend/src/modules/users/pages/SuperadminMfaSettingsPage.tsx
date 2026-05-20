import { useEffect, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
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

function SectionPanel({
  title,
  description,
  children,
  variant = "default",
}: {
  title: string;
  description?: string;
  children: ReactNode;
  variant?: "default" | "danger";
}) {
  const borderClass =
    variant === "danger" ? "border-rose-200" : "border-slate-200";
  const headerClass =
    variant === "danger" ? "border-rose-100 bg-rose-50/50" : "border-slate-100";

  return (
    <section className={`rounded-lg border bg-white shadow-sm ${borderClass}`}>
      <div className={`border-b px-3 py-2.5 ${headerClass}`}>
        <h2
          className={`text-sm font-semibold ${variant === "danger" ? "text-rose-900" : "text-slate-900"}`}
        >
          {title}
        </h2>
        {description ? (
          <p
            className={`mt-0.5 text-xs ${variant === "danger" ? "text-rose-700" : "text-slate-500"}`}
          >
            {description}
          </p>
        ) : null}
      </div>
      <div className="p-3">{children}</div>
    </section>
  );
}

function StatusPill({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: ReactNode;
  tone?: "ok" | "warn" | "bad" | "neutral";
}) {
  const toneClass =
    tone === "ok"
      ? "bg-emerald-50 text-emerald-900 ring-emerald-200"
      : tone === "warn"
        ? "bg-amber-50 text-amber-900 ring-amber-200"
        : tone === "bad"
          ? "bg-rose-50 text-rose-900 ring-rose-200"
          : "bg-slate-50 text-slate-800 ring-slate-200";

  return (
    <div className={`rounded-md px-2.5 py-1.5 ring-1 ring-inset ${toneClass}`}>
      <p className="text-[10px] font-medium uppercase tracking-wide opacity-80">{label}</p>
      <p className="mt-0.5 text-xs font-semibold">{value}</p>
    </div>
  );
}

function btnSecondary(extra = "") {
  return `rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60 ${extra}`.trim();
}

function btnPrimary(extra = "") {
  return `rounded-md bg-orange-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-orange-700 disabled:opacity-60 ${extra}`.trim();
}

function btnSuccess(extra = "") {
  return `rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-60 ${extra}`.trim();
}

function btnDanger(extra = "") {
  return `rounded-md bg-rose-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-rose-700 disabled:opacity-60 ${extra}`.trim();
}

const inputClass =
  "w-full max-w-[10rem] rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-800 placeholder:text-slate-400 focus:border-orange-400 focus:outline-none focus:ring-1 focus:ring-orange-400";

export default function SuperadminMfaSettingsPage() {
  const { t } = useTranslation();
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
      toastT.error(
        getApiErrorMessage(err, t("pages.superadminMfaSettings.loadError")),
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadStatus();
  }, []);

  const copyText = async (text: string, successKey: "copySecret" | "copyOtpauth") => {
    try {
      await navigator.clipboard.writeText(text);
      toastT.success(t(`pages.superadminMfaSettings.${successKey}`));
    } catch {
      toastT.error(t("pages.superadminMfaSettings.copyFailed"));
    }
  };

  const startEnrollment = async () => {
    setWorking(true);
    try {
      const data = await startSuperadminMfaEnrollment();
      setEnrollment(data);
      toastT.success(t("pages.superadminMfaSettings.enrollStarted"));
      await loadStatus();
    } catch (err: unknown) {
      toastT.error(
        getApiErrorMessage(err, t("pages.superadminMfaSettings.enrollStartError")),
      );
    } finally {
      setWorking(false);
    }
  };

  const confirmEnrollment = async () => {
    setWorking(true);
    try {
      const normalizedCode = setupCode.trim();
      await confirmSuperadminMfaEnrollment(normalizedCode);
      const stepUp = await issueSuperadminStepUpSession(normalizedCode);
      sessionStorage.setItem(
        STEP_UP_STORAGE_KEY,
        JSON.stringify({ token: stepUp.stepUpToken, expiresAt: stepUp.expiresAt }),
      );
      setSetupCode("");
      setEnrollment(null);
      toastT.success(t("pages.superadminMfaSettings.enrollConfirmed"));
      await loadStatus();
    } catch (err: unknown) {
      toastT.error(
        getApiErrorMessage(err, t("pages.superadminMfaSettings.enrollConfirmError")),
      );
    } finally {
      setWorking(false);
    }
  };

  const disableMfa = async () => {
    setWorking(true);
    try {
      await disableSuperadminMfa(disableCode.trim());
      setDisableCode("");
      toastT.success(t("pages.superadminMfaSettings.disabled"));
      await loadStatus();
    } catch (err: unknown) {
      toastT.error(
        getApiErrorMessage(err, t("pages.superadminMfaSettings.disableError")),
      );
    } finally {
      setWorking(false);
    }
  };

  const yesNo = (value: boolean) =>
    value ? t("pages.superadminMfaSettings.yes") : t("pages.superadminMfaSettings.no");

  return (
    <div className="mx-auto max-w-3xl space-y-3 p-3 md:p-4">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-xl font-bold tracking-tight text-slate-900">
            {t("pages.superadminMfaSettings.title")}
          </h1>
          <p className="mt-0.5 text-xs text-slate-500">
            {t("pages.superadminMfaSettings.subtitle")}
          </p>
        </div>
        <Link to="/superadmin" className={btnSecondary()}>
          {t("pages.superadminMfaSettings.backToPanel")}
        </Link>
      </header>

      {loading ? (
        <div className="rounded-lg border border-slate-200 bg-white px-4 py-8 text-center text-sm text-slate-600">
          {t("pages.superadminMfaSettings.loading")}
        </div>
      ) : (
        <>
          <SectionPanel
            title={t("pages.superadminMfaSettings.statusTitle")}
            description={t("pages.superadminMfaSettings.statusDesc")}
          >
            <div className="space-y-2.5">
              <div
                className={
                  status?.enabled
                    ? "rounded-md border border-emerald-200 bg-emerald-50/80 px-3 py-2 text-xs text-emerald-900"
                    : "rounded-md border border-amber-200 bg-amber-50/80 px-3 py-2 text-xs text-amber-900"
                }
              >
                {status?.enabled
                  ? t("pages.superadminMfaSettings.bannerActive")
                  : t("pages.superadminMfaSettings.bannerInactive")}
              </div>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                <StatusPill
                  label={t("pages.superadminMfaSettings.requiredLabel")}
                  value={yesNo(Boolean(status?.required))}
                  tone={status?.required ? "warn" : "neutral"}
                />
                <StatusPill
                  label={t("pages.superadminMfaSettings.enabledLabel")}
                  value={yesNo(Boolean(status?.enabled))}
                  tone={status?.enabled ? "ok" : "bad"}
                />
                <StatusPill
                  label={t("pages.superadminMfaSettings.pendingLabel")}
                  value={yesNo(Boolean(status?.pendingSetup))}
                  tone={status?.pendingSetup ? "warn" : "ok"}
                />
              </div>
            </div>
          </SectionPanel>

          {!status?.enabled && (
            <SectionPanel
              title={t("pages.superadminMfaSettings.step1Title")}
              description={t("pages.superadminMfaSettings.step1Desc")}
            >
              <button
                type="button"
                onClick={() => void startEnrollment()}
                disabled={working}
                className={btnPrimary()}
              >
                {t("pages.superadminMfaSettings.generateSecret")}
              </button>
              {enrollment && (
                <div className="mt-3 space-y-2 rounded-md border border-amber-200 bg-amber-50/60 p-2.5 text-xs">
                  <div className="grid gap-1.5 sm:grid-cols-2">
                    <p>
                      <span className="font-medium text-slate-700">
                        {t("pages.superadminMfaSettings.issuer")}:
                      </span>{" "}
                      {enrollment.issuer}
                    </p>
                    <p>
                      <span className="font-medium text-slate-700">
                        {t("pages.superadminMfaSettings.account")}:
                      </span>{" "}
                      {enrollment.label}
                    </p>
                  </div>
                  <div>
                    <span className="font-medium text-slate-700">
                      {t("pages.superadminMfaSettings.secret")}:
                    </span>
                    <div className="mt-1 flex flex-wrap items-center gap-2">
                      <code className="rounded bg-white/80 px-2 py-1 font-mono text-[11px] ring-1 ring-amber-200">
                        {enrollment.secret}
                      </code>
                      <button
                        type="button"
                        className={btnSecondary()}
                        onClick={() => void copyText(enrollment.secret, "copySecret")}
                      >
                        {t("pages.superadminMfaSettings.copy")}
                      </button>
                    </div>
                  </div>
                  <p className="text-slate-600">{t("pages.superadminMfaSettings.otpauthHint")}</p>
                  <code className="block max-h-20 overflow-auto whitespace-pre-wrap break-all rounded bg-white/80 p-2 font-mono text-[10px] ring-1 ring-amber-200">
                    {enrollment.otpauthUrl}
                  </code>
                  <button
                    type="button"
                    className={btnSecondary()}
                    onClick={() => void copyText(enrollment.otpauthUrl, "copyOtpauth")}
                  >
                    {t("pages.superadminMfaSettings.copyOtpauth")}
                  </button>
                </div>
              )}
            </SectionPanel>
          )}

          {!status?.enabled && (
            <SectionPanel
              title={t("pages.superadminMfaSettings.step2Title")}
              description={t("pages.superadminMfaSettings.step2Desc")}
            >
              <div className="flex flex-wrap items-end gap-2">
                <label className="block min-w-0 flex-1">
                  <span className="mb-1 block text-[10px] font-medium uppercase tracking-wide text-slate-500">
                    {t("pages.superadminMfaSettings.codeLabel")}
                  </span>
                  <input
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    value={setupCode}
                    onChange={(e) => setSetupCode(e.target.value)}
                    placeholder={t("pages.superadminMfaSettings.codePlaceholder")}
                    className={inputClass}
                  />
                </label>
                <button
                  type="button"
                  onClick={() => void confirmEnrollment()}
                  disabled={working || setupCode.trim().length < 6}
                  className={btnSuccess()}
                >
                  {t("pages.superadminMfaSettings.confirmActivate")}
                </button>
              </div>
            </SectionPanel>
          )}

          <SectionPanel
            title={t("pages.superadminMfaSettings.step3Title")}
            description={t("pages.superadminMfaSettings.step3Desc")}
            variant="danger"
          >
            <div className="flex flex-wrap items-end gap-2">
              <label className="block min-w-0 flex-1">
                <span className="mb-1 block text-[10px] font-medium uppercase tracking-wide text-rose-700/80">
                  {t("pages.superadminMfaSettings.codeLabel")}
                </span>
                <input
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  value={disableCode}
                  onChange={(e) => setDisableCode(e.target.value)}
                  placeholder={t("pages.superadminMfaSettings.disablePlaceholder")}
                  className={`${inputClass} border-rose-300 focus:border-rose-400 focus:ring-rose-400`}
                />
              </label>
              <button
                type="button"
                onClick={() => void disableMfa()}
                disabled={working || disableCode.trim().length < 6}
                className={btnDanger()}
              >
                {t("pages.superadminMfaSettings.disableButton")}
              </button>
            </div>
          </SectionPanel>
        </>
      )}
    </div>
  );
}
