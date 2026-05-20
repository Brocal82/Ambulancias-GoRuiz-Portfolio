import { Link, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import LanguageSwitcher from "../components/ui/LanguageSwitcher";
import { useTranslation } from "react-i18next";
import { buildImageUrl } from "../utils/apiOrigins";
import { homePathForRole } from "../utils/roleHomePath";

export default function SuperadminAppLayout() {
  const { logout, role, user } = useAuth();
  const navigate = useNavigate();
  const { t } = useTranslation();

  const goHome = () => navigate(homePathForRole(role ?? null));

  return (
    <div className="fixed inset-0 flex flex-col bg-slate-100 text-slate-900">
      <header
        className="shrink-0 z-40 bg-slate-900 border-b border-slate-800"
        role="banner"
      >
        <div className="w-full px-4 sm:px-6 lg:px-8 h-16 flex items-center gap-4">
          <button
            type="button"
            onClick={goHome}
            title={t("layout.actions.goHome") as string}
            aria-label={t("layout.actions.goHome") as string}
            className="group inline-flex items-center gap-3 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-300 rounded-lg"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-6 w-6 text-slate-200 group-hover:text-white transition-colors"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M3 9.75L12 3l9 6.75M4.5 10.5V21h15v-10.5"
              />
            </svg>
            <span className="text-lg sm:text-xl font-semibold tracking-tight text-slate-50 max-w-[50vw] sm:max-w-md truncate">
              {t("layout.superadminTitle")}
            </span>
          </button>

          <div className="flex-1" />

          <nav
            className="flex items-center gap-3 sm:gap-4"
            aria-label={t("layout.nav.actions") as string}
          >
            {user && (
              <div className="flex items-center gap-3">
                <span className="text-sm font-medium text-slate-200 hidden sm:inline">
                  {user.lastName}, {user.name}
                </span>
                <Link
                  to="/profile"
                  title={t("layout.actions.profile") as string}
                  aria-label={t("layout.actions.profile") as string}
                  className="shrink-0"
                >
                  <img
                    src={
                      user.profileImage
                        ? buildImageUrl(user.profileImage)
                        : "https://cdn-icons-png.flaticon.com/512/149/149071.png"
                    }
                    alt={
                      t("layout.avatarAlt", {
                        name: `${user.name} ${user.lastName}`,
                      }) as string
                    }
                    className="w-9 h-9 rounded-full ring-1 ring-slate-600 object-cover transition-transform hover:scale-105"
                  />
                </Link>
              </div>
            )}

            <button
              type="button"
              onClick={logout}
              className="inline-flex items-center justify-center rounded-lg bg-rose-500 px-3 py-1.5 text-sm font-medium text-white shadow-sm hover:bg-rose-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-300"
              title={t("layout.actions.logout") as string}
              aria-label={t("layout.actions.logout") as string}
            >
              {t("layout.logout")}
            </button>
          </nav>

          <div className="ml-2">
            <LanguageSwitcher />
          </div>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden min-h-0">
        <Outlet />
      </div>
    </div>
  );
}
