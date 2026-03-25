import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { getMyCompany } from "../../companies/domain/api";
import type { Company } from "../../companies/domain/types";
import { createInvitation } from "../domain/api";
import type { CreateInvitationResponse } from "../domain/types";
import { toastT, getApiErrorMessage } from "../../../utils/toast";

export default function AdminInvitationsPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [company, setCompany] = useState<Company | null>(null);
  const [companyLoading, setCompanyLoading] = useState(true);
  const [localPart, setLocalPart] = useState("");
  const [fullEmail, setFullEmail] = useState("");
  const [employeeNumber, setEmployeeNumber] = useState("");
  const [role, setRole] = useState<"admin" | "worker">("worker");
  const [expiresInDaysRaw, setExpiresInDaysRaw] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<CreateInvitationResponse | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const c = await getMyCompany();
        if (!cancelled) setCompany(c);
      } catch (e: unknown) {
        if (!cancelled) {
          toastT.error(
            getApiErrorMessage(e, t("pages.adminInvitations.errorCreateFallback")),
          );
        }
      } finally {
        if (!cancelled) setCompanyLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [t]);

  const useDomain = Boolean(company?.emailDomain?.trim());

  const invitationLink = result?.token
    ? `${window.location.origin}/invitation/accept?token=${encodeURIComponent(result.token)}`
    : "";

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const email = useDomain
      ? `${localPart.trim()}${company!.emailDomain!}`
      : fullEmail.trim();
    if (!email) {
      toastT.error(t("pages.adminInvitations.emailRequired"));
      return;
    }
    setSubmitting(true);
    try {
      const expiresParsed = expiresInDaysRaw.trim();
      const expiresNum =
        expiresParsed === "" ? undefined : Number.parseInt(expiresParsed, 10);
      const empTrim = employeeNumber.trim();
      const payload = {
        email,
        role,
        ...(expiresNum != null &&
        !Number.isNaN(expiresNum) &&
        expiresNum >= 1 &&
        expiresNum <= 90
          ? { expiresInDays: expiresNum }
          : {}),
        ...(empTrim ? { employeeNumber: empTrim } : {}),
      };
      const data = await createInvitation(payload);
      toastT.success(t("pages.adminInvitations.toastCreateSuccess"));
      setLocalPart("");
      setFullEmail("");
      setEmployeeNumber("");
      setRole("worker");
      setExpiresInDaysRaw("");
      setResult(data);
    } catch (err: unknown) {
      toastT.error(
        getApiErrorMessage(err, t("pages.adminInvitations.errorCreateFallback")),
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleCopyLink = async () => {
    if (!invitationLink) return;
    try {
      await navigator.clipboard.writeText(invitationLink);
      toastT.success(t("pages.adminInvitations.toastCopySuccess"));
    } catch {
      toastT.error(t("pages.adminInvitations.toastCopyError"));
    }
  };

  if (companyLoading) {
    return (
      <div className="min-h-screen bg-gray-100 p-6 max-w-2xl mx-auto">
        <p className="text-slate-600">{t("pages.adminInvitations.loadingCompany")}</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 p-6 max-w-2xl mx-auto">
      <div className="mb-6 flex items-center gap-4">
        <button
          type="button"
          onClick={() => navigate("/admin")}
          className="text-sm text-blue-600 hover:underline"
        >
          {t("pages.adminInvitations.backToPanel")}
        </button>
      </div>

      <h1 className="text-2xl font-bold text-slate-900 mb-2">
        {t("pages.adminInvitations.title")}
      </h1>
      <p className="text-sm text-slate-600 mb-6">
        {t("pages.adminInvitations.intro")}
      </p>

      {!useDomain && (
        <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 mb-4">
          {t("pages.adminInvitations.noEmailDomainHint")}
        </p>
      )}

      {!result && (
        <p className="text-sm text-slate-600 mb-4 rounded-lg border border-slate-200 bg-white/80 px-4 py-3">
          {t("pages.adminInvitations.hintBeforeCreate")}
        </p>
      )}

      <form
        onSubmit={handleSubmit}
        className="bg-white rounded-lg shadow border border-slate-200 p-6 space-y-4"
      >
        {useDomain ? (
          <div>
            <span className="block text-sm font-medium text-slate-700 mb-1">
              {t("pages.adminInvitations.email")}
            </span>
            <div className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-center">
              <input
                id="inv-email-local"
                type="text"
                value={localPart}
                onChange={(e) => setLocalPart(e.target.value)}
                className="flex-1 min-w-0 rounded-lg border border-slate-300 px-3 py-2 text-slate-900"
                required
                autoComplete="off"
                placeholder={t("pages.adminInvitations.localPartPlaceholder")}
                aria-label={t("pages.adminInvitations.localPartAria")}
              />
              <span className="text-slate-600 text-sm sm:px-1 shrink-0 font-mono break-all">
                {company!.emailDomain}
              </span>
            </div>
          </div>
        ) : (
          <div>
            <label
              htmlFor="inv-email"
              className="block text-sm font-medium text-slate-700 mb-1"
            >
              {t("pages.adminInvitations.email")}
            </label>
            <input
              id="inv-email"
              type="email"
              value={fullEmail}
              onChange={(e) => setFullEmail(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900"
              required
              autoComplete="off"
            />
          </div>
        )}

        <div>
          <label
            htmlFor="inv-employee-number"
            className="block text-sm font-medium text-slate-700 mb-1"
          >
            {t("pages.adminInvitations.employeeNumber")}
          </label>
          <input
            id="inv-employee-number"
            type="text"
            value={employeeNumber}
            onChange={(e) => setEmployeeNumber(e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900"
            autoComplete="off"
            placeholder={t("pages.adminInvitations.employeeNumberPlaceholder")}
          />
          <p className="text-xs text-slate-500 mt-1">
            {t("pages.adminInvitations.employeeNumberHint")}
          </p>
        </div>

        <div>
          <label
            htmlFor="inv-role"
            className="block text-sm font-medium text-slate-700 mb-1"
          >
            {t("pages.adminInvitations.role")}
          </label>
          <select
            id="inv-role"
            value={role}
            onChange={(e) =>
              setRole(e.target.value as "admin" | "worker")
            }
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900"
          >
            <option value="worker">{t("pages.adminInvitations.roleWorker")}</option>
            <option value="admin">{t("pages.adminInvitations.roleAdmin")}</option>
          </select>
        </div>

        <div>
          <label
            htmlFor="inv-expires"
            className="block text-sm font-medium text-slate-700 mb-1"
          >
            {t("pages.adminInvitations.expiresLabel")}
          </label>
          <input
            id="inv-expires"
            type="number"
            min={1}
            max={90}
            placeholder={t("pages.adminInvitations.expiresPlaceholder")}
            value={expiresInDaysRaw}
            onChange={(e) => setExpiresInDaysRaw(e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900"
          />
          <p className="text-xs text-slate-500 mt-1">
            {t("pages.adminInvitations.expiresHint")}
          </p>
        </div>

        <button
          type="submit"
          disabled={submitting}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
        >
          {submitting
            ? t("pages.adminInvitations.submitting")
            : t("pages.adminInvitations.submit")}
        </button>
      </form>

      {result && (
        <div className="mt-6 bg-white rounded-lg shadow border border-slate-200 p-6 space-y-4">
          <h2 className="text-lg font-semibold text-slate-900">
            {t("pages.adminInvitations.resultTitle")}
          </h2>

          <div className="text-sm space-y-1">
            <p>
              <span className="font-medium text-slate-700">
                {t("pages.adminInvitations.tokenLabel")}
              </span>{" "}
              <span className="text-slate-600 break-all font-mono text-xs">
                {result.token}
              </span>
            </p>
            <p>
              <span className="font-medium text-slate-700">
                {t("pages.adminInvitations.expiresAtLabel")}
              </span>{" "}
              <span className="text-slate-600">
                {new Date(result.expiresAt).toLocaleString()}
              </span>
            </p>
          </div>

          <div>
            <label
              htmlFor="invitation-link"
              className="block text-sm font-medium text-slate-700 mb-1"
            >
              {t("pages.adminInvitations.linkLabel")}
            </label>
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                id="invitation-link"
                readOnly
                value={invitationLink}
                className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 bg-slate-50"
              />
              <button
                type="button"
                onClick={handleCopyLink}
                className="rounded-lg bg-slate-800 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-900 whitespace-nowrap"
              >
                {t("pages.adminInvitations.copy")}
              </button>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setResult(null)}
            className="text-sm text-blue-600 hover:underline font-medium"
          >
            {t("pages.adminInvitations.createAnother")}
          </button>
        </div>
      )}
    </div>
  );
}
