import { useState, useEffect } from "react";
import { Link, useParams } from "react-router-dom";
import ProfilePage from "./ProfilePage";
import AdminUserDienstsTab from "../../diensts/components/AdminUserDienstsTab";
import AdminUserPraemienTab from "../../praemien/components/AdminUserPraemienTab";
import AdminUserVacationsTab from "../../vacation/components/AdminUserVacationsTab";
import AdminUserSickLeavesTab from "../../sick/components/AdminUserSickLeavesTab";
import AdminUserMessageTab from "../../messages/components/AdminUserMessageTab"; import { useAuth } from "../../../hooks/useAuth";
import * as UsersApi from "../domain/api";
import type { User } from "../domain/types";
import { useTranslation } from "react-i18next";

const TAB_KEYS = [
  "profile",
  "diensts",
  "praemien",
  "vacations",
  "sick",
  "messages",
] as const;

type TabKey = (typeof TAB_KEYS)[number];

const AdminUserDetailDashboard = () => {
  const { userId } = useParams<{ userId: string }>();
  const { token } = useAuth();
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

  const isDiensts = activeTab === "diensts";

  return (
    <div className="min-h-screen bg-slate-50">

      {/* Volver a usuarios */}
      <Link
        to="/admin/users"
        className="mb-4 inline-flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors"
      >
        <span aria-hidden="true">←</span>
        {t("pages.adminUserDetail.backToUsers")}
      </Link>

      {/* Header */}
      <div className="mb-6 flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
          {t("pages.adminUserDetail.title")}
        </h1>

        {loadingUser && (
          <p className="text-sm text-slate-600">
            {t("pages.adminUserDetail.loading")}
          </p>
        )}

        {!loadingUser && user && (
          <p className="text-sm text-slate-700">
            {t("pages.adminUserDetail.nameLabel")}{" "}
            <span className="font-medium text-slate-900">
              {user.name} {user.lastName}
            </span>
          </p>
        )}
      </div>

      {/* Tabs nav */}
      <nav className="mb-6 rounded-2xl bg-white/70 backdrop-blur ring-1 ring-slate-200 shadow-sm p-2 flex justify-center">
        <div className="flex flex-wrap gap-3">
          {TAB_KEYS.map((key) => {
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
      <section className="w-full rounded-2xl bg-white shadow-sm ring-1 ring-slate-200 min-h-[400px]">
        {isDiensts ? (
          // âœ… Diensts SIN padding para no reducir ancho Ãºtil (breakpoints/7 cols)
          <div className="p-0">
            {userId && <AdminUserDienstsTab userId={userId} />}
          </div>
        ) : (
          // âœ… Resto de tabs CON padding consistente
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
  );
};

export default AdminUserDetailDashboard;
