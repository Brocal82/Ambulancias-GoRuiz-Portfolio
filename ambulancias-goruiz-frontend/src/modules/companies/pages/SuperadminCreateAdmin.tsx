import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  createCompanyAdmin,
  createCompanyAdminInvitation,
  getCompanyAdmins,
  getCompanyById,
} from "../domain/api";
import type {
  Company,
  CompanyAdmin,
  CreateCompanyAdminInvitationResponse,
} from "../domain/types";
import { toastT, getApiErrorMessage } from "../../../utils/toast";
import { useStepUpSession } from "../utils/useStepUpSession";
import CopyLinkIconButton from "../../../components/common/actions/CopyLinkIconButton";

type AdminSetupMode = "invite" | "password";

export default function SuperadminCreateAdmin() {
  const { id: companyId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { t } = useTranslation();

  const [company, setCompany] = useState<Company | null>(null);
  const [companyLoading, setCompanyLoading] = useState(true);
  const [existingAdmins, setExistingAdmins] = useState<CompanyAdmin[]>([]);
  const [mode, setMode] = useState<AdminSetupMode>("invite");
  const [name, setName] = useState("");
  const [lastName, setLastName] = useState("");
  const [localPart, setLocalPart] = useState("");
  const [fullEmail, setFullEmail] = useState("");
  const [password, setPassword] = useState("");
  const [expiresInDaysRaw, setExpiresInDaysRaw] = useState("7");
  const [submitting, setSubmitting] = useState(false);
  const [inviteResult, setInviteResult] = useState<CreateCompanyAdminInvitationResponse | null>(
    null,
  );
  const { requestStepUpToken, stepUpModal } = useStepUpSession();

  useEffect(() => {
    if (!companyId) return;
    let cancelled = false;
    (async () => {
      try {
        const [c, admins] = await Promise.all([
          getCompanyById(companyId),
          getCompanyAdmins(companyId),
        ]);
        if (!cancelled) {
          setCompany(c);
          setExistingAdmins(admins);
        }
      } catch (e: unknown) {
        if (!cancelled) {
          toastT.error(getApiErrorMessage(e, t("pages.superadminCreateAdmin.loadError")));
          navigate(`/superadmin/companies/${companyId}`);
        }
      } finally {
        if (!cancelled) setCompanyLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [companyId, navigate, t]);

  const useDomain = Boolean(company?.emailDomain?.trim());

  const resolveEmail = (): string => {
    if (!company) return "";
    return useDomain
      ? `${localPart.trim()}${company.emailDomain!}`
      : fullEmail.trim();
  };

  const invitationLink = inviteResult?.token
    ? `${window.location.origin}/invitation/accept?token=${encodeURIComponent(inviteResult.token)}`
    : "";

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyId) return;
    const email = resolveEmail();
    if (!email) {
      toastT.error(t("pages.superadminCreateAdmin.emailRequired"));
      return;
    }
    setSubmitting(true);
    try {
      const stepUpToken = await requestStepUpToken(
        t("pages.superadminCreateAdmin.inviteStepUp"),
      );
      if (!stepUpToken) {
        toastT.error(t("pages.superadminCreateAdmin.stepUpCancelled"));
        return;
      }
      const expiresParsed = expiresInDaysRaw.trim();
      const expiresNum =
        expiresParsed === "" ? undefined : Number.parseInt(expiresParsed, 10);
      const data = await createCompanyAdminInvitation(
        companyId,
        {
          email,
          ...(expiresNum != null &&
          !Number.isNaN(expiresNum) &&
          expiresNum >= 1 &&
          expiresNum <= 90
            ? { expiresInDays: expiresNum }
            : {}),
        },
        stepUpToken,
      );
      setInviteResult(data);
      toastT.success(t("pages.superadminCreateAdmin.inviteSuccess"));
    } catch (err: unknown) {
      toastT.error(getApiErrorMessage(err, t("pages.superadminCreateAdmin.inviteError")));
    } finally {
      setSubmitting(false);
    }
  };

  const handlePasswordCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyId) return;
    const email = resolveEmail();
    if (!email) {
      toastT.error(t("pages.superadminCreateAdmin.emailRequired"));
      return;
    }
    setSubmitting(true);
    try {
      const stepUpToken = await requestStepUpToken(
        t("pages.superadminCreateAdmin.passwordStepUp"),
      );
      if (!stepUpToken) {
        toastT.error(t("pages.superadminCreateAdmin.stepUpCancelled"));
        return;
      }
      await createCompanyAdmin(
        companyId,
        {
          name: name.trim(),
          lastName: lastName.trim(),
          email,
          password,
        },
        stepUpToken,
      );
      toastT.success(t("pages.superadminCreateAdmin.passwordSuccess"));
      navigate(`/superadmin/companies/${companyId}?tab=overview`);
    } catch (err: unknown) {
      toastT.error(getApiErrorMessage(err, t("pages.superadminCreateAdmin.passwordError")));
    } finally {
      setSubmitting(false);
    }
  };

  if (!companyId) {
    return (
      <div className="p-4">
        <p className="text-red-600">{t("pages.superadminCreateAdmin.missingCompany")}</p>
      </div>
    );
  }

  if (companyLoading) {
    return (
      <div className="p-4 max-w-lg mx-auto">
        <p className="text-slate-600">{t("pages.superadminCreateAdmin.loading")}</p>
      </div>
    );
  }

  const tabClass = (active: boolean) =>
    `px-4 py-2 text-sm rounded-xl border transition ${
      active
        ? "bg-blue-50 text-slate-900 border-orange-300 shadow-md"
        : "bg-white text-slate-700 border-transparent hover:bg-blue-50 hover:border-orange-300"
    }`;

  return (
    <div className="p-4 max-w-lg mx-auto">
      <h1 className="text-2xl font-bold text-slate-900 mb-2">
        {t("pages.superadminCreateAdmin.title")}
      </h1>
      <p className="text-sm text-slate-600 mb-6">{t("pages.superadminCreateAdmin.subtitle")}</p>

      {existingAdmins.length > 0 && (
        <div className="mb-6 rounded-xl border border-slate-200 bg-slate-50 p-4">
          <h2 className="mb-3 text-sm font-semibold text-slate-700">
            {t("pages.superadminCreateAdmin.existingTitle", { count: existingAdmins.length })}
          </h2>
          <ul className="space-y-2">
            {existingAdmins.map((admin) => (
              <li
                key={admin._id}
                className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
              >
                <div className="min-w-0">
                  <p className="font-medium text-slate-800">
                    {admin.name} {admin.lastName}
                  </p>
                  <p className="truncate text-xs text-slate-500">{admin.email}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {!useDomain && (
        <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-4">
          {t("pages.superadminCreateAdmin.noDomainHint")}
        </p>
      )}

      <nav className="mb-6 flex flex-wrap gap-2">
        <button type="button" className={tabClass(mode === "invite")} onClick={() => setMode("invite")}>
          {t("pages.superadminCreateAdmin.modeInvite")}
        </button>
        <button
          type="button"
          className={tabClass(mode === "password")}
          onClick={() => setMode("password")}
        >
          {t("pages.superadminCreateAdmin.modePassword")}
        </button>
      </nav>

      {mode === "invite" ? (
        <form onSubmit={(e) => void handleInvite(e)} className="space-y-4">
          <p className="text-sm text-slate-600">{t("pages.superadminCreateAdmin.inviteDesc")}</p>
          {useDomain ? (
            <div>
              <span className="block text-sm font-medium text-slate-700 mb-1">
                {t("pages.superadminCreateAdmin.email")}
              </span>
              <div className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-center">
                <input
                  type="text"
                  value={localPart}
                  onChange={(e) => setLocalPart(e.target.value)}
                  className="flex-1 min-w-0 rounded-lg border border-slate-300 px-3 py-2 text-slate-900"
                  required
                  placeholder="admin"
                />
                <span className="text-slate-600 text-sm font-mono break-all">
                  {company!.emailDomain}
                </span>
              </div>
            </div>
          ) : (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                {t("pages.superadminCreateAdmin.email")}
              </label>
              <input
                type="email"
                value={fullEmail}
                onChange={(e) => setFullEmail(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900"
                required
              />
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              {t("pages.superadminCreateAdmin.expiresDays")}
            </label>
            <input
              type="number"
              min={1}
              max={90}
              value={expiresInDaysRaw}
              onChange={(e) => setExpiresInDaysRaw(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900"
            />
          </div>
          <div className="flex gap-3 pt-2">
            <button
              type="submit"
              disabled={submitting}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
            >
              {submitting
                ? t("pages.superadminCreateAdmin.inviting")
                : t("pages.superadminCreateAdmin.inviteSubmit")}
            </button>
            <button
              type="button"
              onClick={() => navigate(`/superadmin/companies/${companyId}`)}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              {t("pages.superadminCreateAdmin.cancel")}
            </button>
          </div>
          {inviteResult && invitationLink && (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 space-y-2">
              <p className="text-sm font-medium text-emerald-900">
                {t("pages.superadminCreateAdmin.linkReady")}
              </p>
              <p className="text-xs text-emerald-800 break-all font-mono">{invitationLink}</p>
              <CopyLinkIconButton
                title={t("pages.superadminCreateAdmin.copyLink")}
                onClick={() => {
                  void navigator.clipboard.writeText(invitationLink);
                  toastT.success(t("pages.superadminCreateAdmin.linkCopied"));
                }}
              />
            </div>
          )}
        </form>
      ) : (
        <form onSubmit={(e) => void handlePasswordCreate(e)} className="space-y-4">
          <p className="text-sm text-slate-600">{t("pages.superadminCreateAdmin.passwordDesc")}</p>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              {t("pages.superadminCreateAdmin.name")}
            </label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              {t("pages.superadminCreateAdmin.lastName")}
            </label>
            <input
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2"
              required
            />
          </div>
          {useDomain ? (
            <div>
              <span className="block text-sm font-medium text-slate-700 mb-1">
                {t("pages.superadminCreateAdmin.email")}
              </span>
              <div className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-center">
                <input
                  value={localPart}
                  onChange={(e) => setLocalPart(e.target.value)}
                  className="flex-1 rounded-lg border border-slate-300 px-3 py-2"
                  required
                />
                <span className="text-sm font-mono text-slate-600">{company!.emailDomain}</span>
              </div>
            </div>
          ) : (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                {t("pages.superadminCreateAdmin.email")}
              </label>
              <input
                type="email"
                value={fullEmail}
                onChange={(e) => setFullEmail(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2"
                required
              />
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              {t("pages.superadminCreateAdmin.password")}
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              minLength={8}
              className="w-full rounded-lg border border-slate-300 px-3 py-2"
              required
            />
          </div>
          <div className="flex gap-3 pt-2">
            <button
              type="submit"
              disabled={submitting}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
            >
              {submitting
                ? t("pages.superadminCreateAdmin.creating")
                : t("pages.superadminCreateAdmin.passwordSubmit")}
            </button>
            <button
              type="button"
              onClick={() => navigate(`/superadmin/companies/${companyId}`)}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700"
            >
              {t("pages.superadminCreateAdmin.cancel")}
            </button>
          </div>
        </form>
      )}

      {stepUpModal}
    </div>
  );
}
