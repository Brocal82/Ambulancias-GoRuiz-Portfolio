// src/layouts/AppLayout.tsx
import { useEffect, useState } from "react";
import { Link, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import LanguageSwitcher from "../components/ui/LanguageSwitcher";
import { useTranslation } from "react-i18next";
import { buildImageUrl } from "../utils/apiOrigins";
import { getMyCompany } from "../modules/companies/domain/api";

export default function AppLayout() {
  const { logout, role, user, isAuthReady } = useAuth();
  const [headerCompanyName, setHeaderCompanyName] = useState<string | null>(null);

  const navigate = useNavigate();
  const { t } = useTranslation();

  useEffect(() => {
    if (
      !isAuthReady ||
      role === "superadmin" ||
      !user?.companyId ||
      !user?._id
    ) {
      setHeaderCompanyName(null);
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        const company = await getMyCompany();
        if (!cancelled) {
          setHeaderCompanyName(company?.name?.trim() || null);
        }
      } catch {
        if (!cancelled) {
          setHeaderCompanyName(null);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isAuthReady, role, user?._id, user?.companyId]);

  const goHome = () => {
    if (role === "superadmin") navigate("/superadmin");
    else if (role === "admin") navigate("/admin");
    else navigate("/worker");
  };

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-slate-100 to-slate-200 text-slate-900">
      {/* Header */}
      <header
        className="sticky top-0 z-40 bg-slate-900/95 backdrop-blur border-b border-slate-800"
        role="banner"
      >
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 h-16 flex items-center gap-4">
          {/* Izquierda: logo/nombre app */}
          <button
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
            <span className="text-lg sm:text-xl font-semibold tracking-tight text-slate-50 max-w-[40vw] sm:max-w-md truncate">
              {role === "superadmin"
                ? t("layout.superadminTitle")
                : headerCompanyName
                  ? `${t("layout.appNamePrefix")} ${headerCompanyName.toUpperCase()}`
                  : t("layout.appName")}
            </span>
          </button>

          {/* Spacer */}
          <div className="flex-1" />

          {/* Derecha: usuario + logout */}
          <nav
            className="flex items-center gap-3 sm:gap-4"
            aria-label={t("layout.nav.actions") as string}
          >
            {user && (
              <div className="flex items-center gap-3">
                <div className="flex min-w-0 flex-col">
                  <span className="text-sm font-medium text-slate-200">
                    {user.lastName}, {user.name}
                  </span>
                  {role === "worker" && user.employeeNumber?.trim() ? (
                    <span className="text-xs font-semibold text-orange-400 leading-tight">
                      {user.employeeNumber}
                    </span>
                  ) : null}
                </div>

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
              onClick={logout}
              className="inline-flex items-center justify-center rounded-lg bg-rose-500 px-3 py-1.5 text-sm font-medium text-white
                   shadow-sm hover:bg-rose-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-300"
              title={t("layout.actions.logout") as string}
              aria-label={t("layout.actions.logout") as string}
            >
              {t("layout.logout")}
            </button>
          </nav>

          {/* Esquina derecha: switcher */}
          <div className="ml-2">
            <LanguageSwitcher />
          </div>
        </div>
      </header>

      {/* Main grows to push footer down */}
      <main role="main" className="flex-1">
        <div className="mx-auto max-w-[1600px] px-4 sm:px-6 lg:px-8 py-6">
          <div className="rounded-2xl bg-slate-50/90 ring-1 ring-slate-200 shadow-sm p-4 sm:p-6">
            {/* ✅ Aquí va la página actual */}
            <Outlet />
          </div>
        </div>
      </main>

      {/* Footer always at the bottom */}
      <footer className="bg-slate-900 border-t border-slate-800">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-4 text-center text-xs sm:text-sm text-slate-200">
          &copy; 2025 Ambulancias Gorruiz
        </div>
      </footer>
    </div>
  );
}
