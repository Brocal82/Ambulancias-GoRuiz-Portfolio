import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import PublicLayout from "../layouts/PublicLayout";

/**
 * Placeholder hasta la fase de onboarding por invitación (validación + formulario).
 */
export default function InvitationAcceptPlaceholder() {
  const navigate = useNavigate();
  const { t } = useTranslation();

  return (
    <PublicLayout backTo="/" backLabel={t("pages.invitationAccept.back")}>
      <div className="w-full max-w-md bg-slate-900/95 backdrop-blur rounded-2xl shadow-lg border border-slate-800 p-8 text-center">
        <h1 className="text-xl font-bold text-white mb-3">
          {t("pages.invitationAccept.title")}
        </h1>
        <p className="text-slate-300 text-sm mb-6">
          {t("pages.invitationAccept.body")}
        </p>
        <button
          type="button"
          onClick={() => navigate("/login")}
          className="w-full rounded-lg bg-blue-500 px-4 py-2 font-semibold text-white shadow-sm hover:bg-blue-600"
        >
          {t("pages.invitationAccept.goLogin")}
        </button>
      </div>
    </PublicLayout>
  );
}
