import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { getMyCompany } from "../../companies/domain/api";
import type { Company } from "../../companies/domain/types";
import { createInvitation } from "../domain/api";
import type { CreateInvitationResponse } from "../domain/types";
import { toastT, getApiErrorMessage } from "../../../utils/toast";
import CreateInvitationIconButton from "../../../components/common/actions/CreateInvitationIconButton";
import CreateIconButton from "../../../components/common/actions/CreateIconButton";
import CopyLinkIconButton from "../../../components/common/actions/CopyLinkIconButton";

type InvitationRole =
  | "admin"
  | "worker"
  | "mecanico"
  | "jefe_mecanicos"
  | "jefe_logistica";

type InvitationSnapshot = {
  role: InvitationRole;
  employeeNumber: string;
  email: string;
};

export default function AdminInvitationsPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [company, setCompany] = useState<Company | null>(null);
  const [companyLoading, setCompanyLoading] = useState(true);
  const [localPart, setLocalPart] = useState("");
  const [fullEmail, setFullEmail] = useState("");
  const [employeeNumber, setEmployeeNumber] = useState("");
  const [role, setRole] = useState<InvitationRole>("worker");
  const [expiresInDaysRaw, setExpiresInDaysRaw] = useState("2");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<CreateInvitationResponse | null>(null);
  const [lastInvitationData, setLastInvitationData] =
    useState<InvitationSnapshot | null>(null);

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

  const canSubmit = useDomain
    ? localPart.trim().length > 0
    : fullEmail.trim().length > 0;

  const roleLabelMap: Record<InvitationRole, string> = {
    worker: t("pages.adminInvitations.roleWorker"),
    mecanico: t("pages.adminInvitations.roleMechanic"),
    jefe_mecanicos: t("pages.adminInvitations.roleMechanicsChief"),
    jefe_logistica: t("pages.adminInvitations.roleLogisticsChief"),
    admin: t("pages.adminInvitations.roleAdmin"),
  };

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
      setLastInvitationData({
        role,
        employeeNumber: empTrim,
        email,
      });
      setLocalPart("");
      setFullEmail("");
      setEmployeeNumber("");
      setRole("worker");
      setExpiresInDaysRaw("2");
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
    <div className="min-h-screen bg-slate-50 p-6 max-w-4xl mx-auto">
      <div className="mb-6 flex items-center gap-4">
        <button
          type="button"
          onClick={() => navigate("/admin")}
          className="text-sm text-blue-600 hover:underline"
        >
          {t("pages.adminInvitations.backToPanel")}
        </button>
      </div>

      <div className="rounded-2xl bg-white shadow ring-1 ring-slate-200 overflow-hidden">
        <div className="px-5 py-4 bg-slate-900">
          <h1 className="text-base sm:text-lg font-semibold tracking-tight text-white">
            {t("pages.adminInvitations.title")}
          </h1>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-5">
          <div className="grid grid-cols-1 lg:grid-cols-[170px_170px_minmax(280px,1fr)_110px] gap-3 items-end">
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
                onChange={(e) => setRole(e.target.value as InvitationRole)}
                className="h-9 w-full rounded-lg border border-slate-300 px-3 text-slate-900"
              >
                <option value="worker">{t("pages.adminInvitations.roleWorker")}</option>
                <option value="mecanico">{t("pages.adminInvitations.roleMechanic")}</option>
                <option value="jefe_mecanicos">
                  {t("pages.adminInvitations.roleMechanicsChief")}
                </option>
                <option value="jefe_logistica">
                  {t("pages.adminInvitations.roleLogisticsChief")}
                </option>
                <option value="admin">{t("pages.adminInvitations.roleAdmin")}</option>
              </select>
            </div>

            <div>
              <label
                htmlFor="inv-employee-number"
                className="block text-sm font-medium text-slate-700 mb-1"
              >
                Numero ID
              </label>
              <input
                id="inv-employee-number"
                type="text"
                value={employeeNumber}
                onChange={(e) => setEmployeeNumber(e.target.value)}
                className="h-9 w-full rounded-lg border border-slate-300 px-3 text-slate-900"
                autoComplete="off"
                placeholder={t("pages.adminInvitations.employeeNumberPlaceholder")}
              />
            </div>

            <div className="lg:col-span-2">
              <span className="block text-sm font-medium text-slate-700 mb-1">
                {t("pages.adminInvitations.email")}
              </span>
              {useDomain ? (
                <div className="flex gap-2 items-center">
                  <input
                    id="inv-email-local"
                    type="text"
                    value={localPart}
                    onChange={(e) => setLocalPart(e.target.value)}
                    className="h-9 flex-1 min-w-0 rounded-lg border border-slate-300 px-3 text-slate-900"
                    required
                    autoComplete="off"
                    placeholder={t("pages.adminInvitations.localPartPlaceholder")}
                    aria-label={t("pages.adminInvitations.localPartAria")}
                  />
                  <span className="text-slate-600 text-sm shrink-0 font-mono">
                    {company!.emailDomain}
                  </span>
                </div>
              ) : (
                <input
                  id="inv-email"
                  type="email"
                  value={fullEmail}
                  onChange={(e) => setFullEmail(e.target.value)}
                  className="h-9 w-full rounded-lg border border-slate-300 px-3 text-slate-900"
                  required
                  autoComplete="off"
                />
              )}
            </div>
          </div>

          <div className="pt-3 flex items-end justify-between gap-4">
            <div>
              <label
                htmlFor="inv-expires-bottom"
                className="block text-sm font-medium text-slate-700 mb-1"
              >
                Caduca
              </label>
              <input
                id="inv-expires-bottom"
                type="number"
                min={1}
                max={90}
                placeholder={t("pages.adminInvitations.expiresPlaceholder")}
                value={expiresInDaysRaw}
                onChange={(e) => setExpiresInDaysRaw(e.target.value)}
                className="h-8 w-12 rounded-lg border border-slate-300 px-2 text-sm text-slate-900"
              />
            </div>
            <div>
              <CreateInvitationIconButton
                disabled={submitting || !canSubmit}
                title={
                  submitting
                    ? t("pages.adminInvitations.submitting")
                    : !canSubmit
                      ? t("pages.adminInvitations.emailRequired")
                      : t("pages.adminInvitations.submit")
                }
              />
            </div>
          </div>
        </form>
      </div>

      {result && (
        <div className="mt-6 space-y-3">
          <div className="bg-white rounded-2xl shadow-sm ring-1 ring-slate-200 p-5">
            <h2 className="text-lg font-semibold text-slate-900">Invitacion</h2>
            {lastInvitationData && (
              <p className="mt-1 text-xs text-slate-500">
                <span className="font-medium text-slate-600">Rol:</span>{" "}
                {roleLabelMap[lastInvitationData.role]}
                {"  |  "}
                <span className="font-medium text-slate-600">Numero ID:</span>{" "}
                {lastInvitationData.employeeNumber || "-"}
                {"  |  "}
                <span className="font-medium text-slate-600">Email:</span>{" "}
                {lastInvitationData.email}
              </p>
            )}
            <div className="mt-3 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <p className="text-sm text-slate-600 md:flex-1">
                <span className="font-medium text-slate-700">
                  {t("pages.adminInvitations.expiresAtLabel")}:
                </span>{" "}
                {new Date(result.expiresAt).toLocaleString()}
              </p>
              <div className="flex min-w-0 items-center gap-2 md:flex-1 md:justify-end">
                <label
                  htmlFor="invitation-link"
                  className="text-sm font-medium text-slate-700 whitespace-nowrap"
                >
                  Link:
                </label>
                <input
                  id="invitation-link"
                  readOnly
                  value={invitationLink}
                  className="h-9 w-full max-w-sm rounded-lg border border-slate-300 px-3 text-sm text-slate-900 bg-slate-50"
                />
                <CopyLinkIconButton
                  onClick={handleCopyLink}
                  title={t("pages.adminInvitations.copy")}
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end">
            <CreateIconButton
              onClick={() => setResult(null)}
              label={t("pages.adminInvitations.createAnother")}
            />
          </div>
        </div>
      )}
    </div>
  );
}
