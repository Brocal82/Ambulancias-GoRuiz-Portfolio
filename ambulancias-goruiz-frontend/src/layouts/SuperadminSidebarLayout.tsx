import { useState } from "react";
import { NavLink, Outlet } from "react-router-dom";
import { useTranslation } from "react-i18next";

type NavItemProps = {
  to: string;
  label: string;
  icon: React.ReactNode;
  collapsed: boolean;
  end?: boolean;
};

function NavItem({ to, label, icon, collapsed, end = false }: NavItemProps) {
  return (
    <NavLink
      to={to}
      end={end}
      title={label}
      className={({ isActive }) =>
        [
          "relative flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm font-medium transition-colors",
          isActive
            ? "border border-orange-500 text-white"
            : "border border-transparent text-slate-300 hover:bg-slate-700 hover:text-white",
          collapsed ? "justify-center" : "",
        ].join(" ")
      }
    >
      <span className="shrink-0 w-[18px] h-[18px] flex items-center justify-center">
        {icon}
      </span>
      {!collapsed && <span className="flex-1 truncate">{label}</span>}
    </NavLink>
  );
}

function SectionLabel({ label, collapsed }: { label: string; collapsed: boolean }) {
  if (collapsed) return <hr className="border-slate-700 my-1 mx-1" />;
  return (
    <p className="px-2.5 pt-3 pb-1 text-[10px] font-semibold uppercase tracking-widest text-orange-500 select-none">
      {label}
    </p>
  );
}

export default function SuperadminSidebarLayout() {
  const [collapsed, setCollapsed] = useState(false);
  const { t } = useTranslation();

  return (
    <div className="flex flex-1 overflow-hidden min-h-0">
      <aside
        className={[
          "h-full flex flex-col bg-slate-900 transition-all duration-200 shrink-0 overflow-hidden",
          collapsed ? "w-14" : "w-56",
        ].join(" ")}
      >
        <div
          className={[
            "flex items-center h-11 border-b border-slate-800 px-2",
            collapsed ? "justify-center" : "justify-end",
          ].join(" ")}
        >
          <button
            type="button"
            onClick={() => setCollapsed((c) => !c)}
            className="p-1.5 rounded-md text-slate-400 hover:text-white hover:bg-slate-700 transition-colors"
            title={collapsed ? t("pages.superadminSidebar.expand") : t("pages.superadminSidebar.collapse")}
            aria-label={collapsed ? t("pages.superadminSidebar.expand") : t("pages.superadminSidebar.collapse")}
          >
            {collapsed ? <ChevronRightIcon /> : <ChevronLeftIcon />}
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto overflow-x-hidden p-2 space-y-0.5">
          <NavItem
            to="/superadmin"
            end
            icon={<HomeIcon />}
            label={t("pages.superadminSidebar.dashboard")}
            collapsed={collapsed}
          />

          <SectionLabel label={t("pages.superadminSidebar.sectionPlatform")} collapsed={collapsed} />
          <NavItem
            to="/superadmin/companies"
            icon={<BuildingIcon />}
            label={t("pages.superadminSidebar.companies")}
            collapsed={collapsed}
          />
          <NavItem
            to="/superadmin/support-access"
            icon={<ShieldIcon />}
            label={t("pages.superadminSidebar.supportAccess")}
            collapsed={collapsed}
          />

          <SectionLabel label={t("pages.superadminSidebar.sectionSecurity")} collapsed={collapsed} />
          <NavItem
            to="/superadmin/security-monitoring"
            icon={<ChartIcon />}
            label={t("pages.superadminSidebar.monitoring")}
            collapsed={collapsed}
          />
          <NavItem
            to="/superadmin/security-mfa"
            icon={<KeyIcon />}
            label={t("pages.superadminSidebar.mfa")}
            collapsed={collapsed}
          />
        </nav>
      </aside>

      <div className="flex-1 min-w-0 overflow-auto bg-slate-50/90 p-4 sm:p-6">
        <Outlet />
      </div>
    </div>
  );
}

function HomeIcon() {
  return (
    <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} className="w-[18px] h-[18px]">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 9.75L12 3l9 6.75M4.5 10.5V21h15V10.5" />
    </svg>
  );
}
function BuildingIcon() {
  return (
    <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} className="w-[18px] h-[18px]">
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 21h19.5m-18-18v18m2.25 0h15M9.75 9.75h4.5M9.75 13.5h4.5M6 21V5.25A2.25 2.25 0 018.25 3h7.5A2.25 2.25 0 0118 5.25V21" />
    </svg>
  );
}
function ShieldIcon() {
  return (
    <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} className="w-[18px] h-[18px]">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
    </svg>
  );
}
function ChartIcon() {
  return (
    <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} className="w-[18px] h-[18px]">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
    </svg>
  );
}
function KeyIcon() {
  return (
    <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} className="w-[18px] h-[18px]">
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 5.25a3 3 0 013 3m3 0a6 6 0 01-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 1121.75 8.25z" />
    </svg>
  );
}
function ChevronLeftIcon() {
  return (
    <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} className="w-4 h-4">
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
    </svg>
  );
}
function ChevronRightIcon() {
  return (
    <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} className="w-4 h-4">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
    </svg>
  );
}
