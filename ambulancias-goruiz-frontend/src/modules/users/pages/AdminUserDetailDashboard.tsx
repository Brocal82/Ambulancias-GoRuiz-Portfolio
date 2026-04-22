import { useState, useEffect } from "react";
import { Link, useParams } from "react-router-dom";
import ProfilePage from "./ProfilePage";
// These imports exist regardless of module state. Components are only
// rendered when their tab is visible (i.e. the module is enabled).
import AdminUserDienstsTab from "../../diensts/components/AdminUserDienstsTab";
import AdminUserPraemienTab from "../../praemien/components/AdminUserPraemienTab";
import AdminUserVacationsTab from "../../vacation/components/AdminUserVacationsTab";
import AdminUserSickLeavesTab from "../../sick/components/AdminUserSickLeavesTab";
import AdminUserMessageTab from "../../messages/components/AdminUserMessageTab";
import { useAuth } from "../../../hooks/useAuth";
import { useModules } from "../../../hooks/useModules";
import * as UsersApi from "../domain/api";
import type { User } from "../domain/types";
import { useTranslation } from "react-i18next";
import { MODULE_KEYS } from "../../../constants/modules";

/** All tabs that can ever appear, in display order. */
const ALL_TAB_KEYS = [
  "profile",
  "diensts",
  "praemien",
  "vacations",
  "sick",
  "messages",
] as const;

type TabKey = (typeof ALL_TAB_KEYS)[number];

/**
 * Maps each tab to the module key that gates it.
 * Tabs without an entry (e.g. "profile") are always visible.
 */
const TAB_MODULE_MAP: Partial<Record<TabKey, string>> = {
  diensts:    MODULE_KEYS.SCHEDULING,
  praemien:   MODULE_KEYS.PRAEMIEN,
  vacations:  MODULE_KEYS.VACATION,
  sick:       MODULE_KEYS.SICK_LEAVES,
  messages:   MODULE_KEYS.MESSAGES,
};

const AdminUserDetailDashboard = () => {
  const { userId } = useParams<{ userId: string }>();
  const { token } = useAuth();
  const { hasModule } = useModules();
  const { t } = useTranslation();

  const [activeTab, setActiveTab] = useState<TabKey>("profile");
  const [user, setUser] = useState<User | null>(null);
  const [loadingUser, setLoadingUser] = useState(true);

  useEffect(() => {
    if (!token || !userId) return;

    setLoadingUser(true);
    UsersApi.getUserById(userId)
      .then(setUser)
      .catch(console.error)
      .finally(() => setLoadingUser(false));
  }, [token, userId]);

  /** Tabs visible to this admin based on company's enabled modules. */
  const visibleTabs = ALL_TAB_KEYS.filter((key) => {
    const moduleKey = TAB_MODULE_MAP[key];
    return !moduleKey || hasModule(moduleKey);
  });

  // If the current tab becomes invisible (module disabled while viewing it),
  // fall back to profile.
  useEffect(() => {
    if (!visibleTabs.includes(activeTab)) {
      setActiveTab("profile");
    }
  }, [visibleTabs, activeTab]);

  const isDiensts = activeTab === "diensts";

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Mismo ancho útil que AdminUsersPage / cola Prämies (max-w-7xl + padding) */}
      <div className="mx-auto min-w-0 max-w-7xl px-4 sm:px-6 lg:px-8 py-4">
        {/* Volver a usuarios */}
        <Link
          to="/admin/users"
          className="mb-4 inline-flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors"
        >
          <span aria-hidden="true">←</span>
          {t("pages.adminUserDetail.backToUsers")}
        </Link>

        {/* Header */}
        {loadingUser && (
          <div className="text-center mb-6">
            <p className="text-sm text-slate-600">
              {t("pages.adminUserDetail.loading")}
            </p>
          </div>
        )}
        {!loadingUser && user && (
          <div className="flex items-baseline justify-center gap-3 mb-6">
            <h2 className="text-xl sm:text-2xl font-semibold text-slate-900">
              {user.name} {user.lastName}
            </h2>

            {user.role === "worker" && user.employeeNumber && (
              <span className="text-[0.95rem] font-semibold text-slate-600 tracking-wide">
                {user.employeeNumber}
              </span>
            )}
          </div>
        )}

        {/* Tabs nav */}
        <nav className="mb-6 rounded-2xl bg-white/70 backdrop-blur ring-1 ring-slate-200 shadow-sm p-2 flex justify-center">
          <div className="flex flex-wrap gap-3">
            {visibleTabs.map((key) => {
              const isActive = activeTab === key;
              return (
                <button
                  key={key}
                  onClick={() => setActiveTab(key)}
                  className={`px-4 py-2 text-sm rounded-xl transition focus:outline-none focus:ring-4 focus:ring-blue-100 ${isActive
                    ? "bg-blue-600 text-white shadow-md -translate-y-0.5"
                    : "bg-white text-slate-700 hover:bg-slate-50 ring-1 ring-slate-200 shadow-sm"
                    }`}
                >
                  {t(`pages.adminUserDetail.tabs.${key}`)}
                </button>
              );
            })}
          </div>
        </nav>

        {/* Content container (unificado) */}
        <section className="w-full min-w-0 rounded-2xl bg-white shadow-sm ring-1 ring-slate-200 min-h-[400px]">
          {isDiensts ? (
            <div className="p-0">
              {userId && <AdminUserDienstsTab userId={userId} />}
            </div>
          ) : (
            <div className="p-6">
              {activeTab === "profile" && userId && <ProfilePage userId={userId} />}
              {activeTab === "praemien" && userId && (
                <AdminUserPraemienTab userId={userId} />
              )}
              {activeTab === "vacations" && userId && (
                <AdminUserVacationsTab userId={userId} />
              )}
              {activeTab === "sick" && userId && (
                <AdminUserSickLeavesTab userId={userId} />
              )}
              {activeTab === "messages" && userId && user && (
                <AdminUserMessageTab
                  userId={userId}
                  userFullName={`${user.lastName}, ${user.name}`}
                />
              )}
            </div>
          )}
        </section>
      </div>
    </div>
  );
};

export default AdminUserDetailDashboard;
