import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import PublicLayout from "../../../layouts/PublicLayout";
import { getApiErrorMessage, toastT } from "../../../utils/toast";
import {
  validateInvitation,
  acceptInvitation,
} from "../domain/api";
import type { ValidateInvitationResponse } from "../domain/types";

type ViewState = "loading" | "valid" | "invalid" | "success" | "no_token";

export default function AcceptInvitationPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token")?.trim() ?? "";

  const [view, setView] = useState<ViewState>("loading");
  const [validation, setValidation] = useState<ValidateInvitationResponse | null>(
    null,
  );
  const [name, setName] = useState("");
  const [lastName, setLastName] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!token) {
      setView("no_token");
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const data = await validateInvitation(token);
        if (cancelled) return;
        if (data.valid) {
          setValidation(data);
          setView("valid");
        } else {
          setValidation(data);
          setView("invalid");
        }
      } catch (err: unknown) {
        if (cancelled) return;
        toastT.error(
          getApiErrorMessage(err, t("pages.invitationAccept.validateError")),
        );
        setView("invalid");
        setValidation({
          valid: false,
          reason: getApiErrorMessage(err, t("pages.invitationAccept.validateError")),
        });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [token, t]);

  useEffect(() => {
    if (view !== "success") return;
    const id = window.setTimeout(() => navigate("/login"), 2000);
    return () => window.clearTimeout(id);
  }, [view, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    setSubmitting(true);
    try {
      await acceptInvitation({
        token,
        name: name.trim(),
        lastName: lastName.trim(),
        password,
      });
      toastT.success(t("pages.invitationAccept.successToast"));
      setView("success");
    } catch (err: unknown) {
      toastT.error(getApiErrorMessage(err, t("pages.invitationAccept.acceptError")));
    } finally {
      setSubmitting(false);
    }
  };

  const invalidReason =
    validation?.reason?.trim() ||
    t("pages.invitationAccept.invalidGeneric");

  const roleLabel =
    validation?.role === "admin"
      ? t("pages.invitationAccept.roleAdmin")
      : validation?.role === "worker"
        ? t("pages.invitationAccept.roleWorker")
        : "";

  return (
    <PublicLayout backTo="/" backLabel={t("pages.invitationAccept.back")}>
      <div className="w-full max-w-md bg-slate-900/95 backdrop-blur rounded-2xl shadow-lg border border-slate-800 p-8">
        {view === "loading" && (
          <div className="flex flex-col items-center justify-center py-12 gap-4">
            <div
              className="h-10 w-10 rounded-full border-2 border-slate-600 border-t-blue-500 animate-spin"
              aria-hidden
            />
            <p className="text-slate-300 text-sm text-center">
              {t("pages.invitationAccept.validating")}
            </p>
          </div>
        )}

        {view === "no_token" && (
          <div className="text-center">
            <h1 className="text-xl font-bold text-white mb-3">
              {t("pages.invitationAccept.noTokenTitle")}
            </h1>
            <p className="text-slate-300 text-sm mb-6">
              {t("pages.invitationAccept.noTokenBody")}
            </p>
            <button
              type="button"
              onClick={() => navigate("/login")}
              className="w-full rounded-lg bg-blue-500 px-4 py-2 font-semibold text-white shadow-sm hover:bg-blue-600"
            >
              {t("pages.invitationAccept.goLogin")}
            </button>
          </div>
        )}

        {view === "invalid" && (
          <div className="text-center">
            <h1 className="text-xl font-bold text-white mb-3">
              {t("pages.invitationAccept.invalidTitle")}
            </h1>
            <p className="text-amber-200/90 text-sm mb-6 whitespace-pre-wrap">
              {invalidReason}
            </p>
            <button
              type="button"
              onClick={() => navigate("/login")}
              className="w-full rounded-lg bg-blue-500 px-4 py-2 font-semibold text-white shadow-sm hover:bg-blue-600"
            >
              {t("pages.invitationAccept.goLogin")}
            </button>
          </div>
        )}

        {view === "valid" && validation?.valid && (
          <>
            <h1 className="text-xl font-bold text-white mb-2 text-center">
              {t("pages.invitationAccept.title")}
            </h1>
            <p className="text-slate-300 text-sm mb-1 text-center">
              {t("pages.invitationAccept.validForCompany", {
                company: validation.companyName || "—",
              })}
            </p>
            {validation.email && (
              <p className="text-slate-400 text-xs mb-1 text-center break-all">
                {validation.email}
              </p>
            )}
            {roleLabel ? (
              <p className="text-slate-400 text-xs mb-1 text-center">
                {t("pages.invitationAccept.roleLabel")}: {roleLabel}
              </p>
            ) : null}
            {validation.role === "worker" &&
              validation.employeeNumber?.trim() && (
                <p className="text-slate-400 text-xs mb-1 text-center">
                  {t("pages.invitationAccept.employeeNumberLabel")}:{" "}
                  {validation.employeeNumber}
                </p>
              )}
            <div className="mb-6" />

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label
                  htmlFor="inv-name"
                  className="block text-sm font-medium text-slate-200 mb-1"
                >
                  {t("pages.invitationAccept.name")}
                </label>
                <input
                  id="inv-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-slate-100 text-slate-900 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-400"
                  required
                  autoComplete="given-name"
                />
              </div>
              <div>
                <label
                  htmlFor="inv-lastname"
                  className="block text-sm font-medium text-slate-200 mb-1"
                >
                  {t("pages.invitationAccept.lastName")}
                </label>
                <input
                  id="inv-lastname"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-slate-100 text-slate-900 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-400"
                  required
                  autoComplete="family-name"
                />
              </div>
              <div>
                <label
                  htmlFor="inv-password"
                  className="block text-sm font-medium text-slate-200 mb-1"
                >
                  {t("pages.invitationAccept.password")}
                </label>
                <input
                  id="inv-password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  minLength={8}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-slate-100 text-slate-900 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-400"
                  required
                  autoComplete="new-password"
                />
                <p className="text-slate-500 text-xs mt-1">
                  {t("pages.invitationAccept.passwordHint")}
                </p>
              </div>
              <button
                type="submit"
                disabled={submitting}
                className="w-full rounded-lg bg-blue-500 px-4 py-2 font-semibold text-white shadow-sm hover:bg-blue-600 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {submitting
                  ? t("pages.invitationAccept.submitting")
                  : t("pages.invitationAccept.submit")}
              </button>
            </form>

            <button
              type="button"
              onClick={() => navigate("/login")}
              className="w-full mt-4 text-sm text-slate-400 hover:text-white underline"
            >
              {t("pages.invitationAccept.goLogin")}
            </button>
          </>
        )}

        {view === "success" && (
          <div className="text-center py-4">
            <h1 className="text-xl font-bold text-green-400 mb-3">
              {t("pages.invitationAccept.successTitle")}
            </h1>
            <p className="text-slate-300 text-sm">
              {t("pages.invitationAccept.successBody")}
            </p>
          </div>
        )}
      </div>
    </PublicLayout>
  );
}
