import { useState } from "react";
import { NavLink, Outlet } from "react-router-dom";
import { useModules } from "../hooks/useModules";
import { MODULE_KEYS } from "../constants/modules";
import { useUnreadMessagesCount } from "../modules/messages/hooks";
import {
  AdminDashboardCountsProvider,
  useAdminDashboardCounts,
} from "../modules/admin-dashboard/hooks";

// ─── Badge ────────────────────────────────────────────────────────────────────

function Badge({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <span className="ml-auto min-w-5 h-5 inline-flex items-center justify-center rounded-full bg-rose-500 text-white text-[10px] font-bold px-1 leading-none shrink-0">
      {count > 99 ? "99+" : count}
    </span>
  );
}

// ─── Nav item ─────────────────────────────────────────────────────────────────

type NavItemProps = {
  to: string;
  label: string;
  icon: React.ReactNode;
  badge?: number;
  collapsed: boolean;
  end?: boolean;
};

function NavItem({ to, label, icon, badge = 0, collapsed, end = false }: NavItemProps) {
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
      {({ isActive }) => (
        <>
          <span className="shrink-0 w-[18px] h-[18px] flex items-center justify-center">
            {icon}
          </span>
          {!collapsed && <span className="flex-1 truncate">{label}</span>}
          {!collapsed && <Badge count={badge} />}
          {collapsed && badge > 0 && (
            <span className={[
              "absolute top-1 right-1 w-2 h-2 rounded-full",
              isActive ? "bg-white" : "bg-rose-500",
            ].join(" ")} />
          )}
        </>
      )}
    </NavLink>
  );
}

// ─── Section label ────────────────────────────────────────────────────────────

function SectionLabel({ label, collapsed }: { label: string; collapsed: boolean }) {
  if (collapsed) return <hr className="border-slate-700 my-1 mx-1" />;
  return (
    <p className="px-2.5 pt-3 pb-1 text-[10px] font-semibold uppercase tracking-widest text-orange-500 select-none">
      {label}
    </p>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function AdminSidebarLayout() {
  return (
    <AdminDashboardCountsProvider>
      <AdminSidebarLayoutInner />
    </AdminDashboardCountsProvider>
  );
}

function AdminSidebarLayoutInner() {
  const [collapsed, setCollapsed] = useState(false);
  const { hasModule } = useModules();
  const { counts } = useAdminDashboardCounts();

  const summariesCount = counts.summaries;
  const vacationsCount = counts.vacations;
  const sickCount = counts.sickLeaves;
  const appointmentsCount = counts.appointments;
  const mechanicsCount = counts.mechanics;
  const praemienCount = counts.praemienManual;
  const { count: messagesCount } = useUnreadMessagesCount({
    skip: !hasModule(MODULE_KEYS.MESSAGES),
  });

  const totalBadge =
    summariesCount + vacationsCount + sickCount + messagesCount + appointmentsCount + mechanicsCount + praemienCount;

  return (
    <div className="flex flex-1 overflow-hidden min-h-0">
      {/* ── Sidebar ─────────────────────────────────────────── */}
      <aside
        className={[
          "h-full flex flex-col bg-slate-900 transition-all duration-200 shrink-0 overflow-hidden",
          collapsed ? "w-14" : "w-56",
        ].join(" ")}
      >
        {/* Toggle */}
        <div
          className={[
            "flex items-center h-11 border-b border-slate-800 px-2",
            collapsed ? "justify-center" : "justify-end",
          ].join(" ")}
        >
          <button
            onClick={() => setCollapsed((c) => !c)}
            className="p-1.5 rounded-md text-slate-400 hover:text-white hover:bg-slate-700 transition-colors"
            title={collapsed ? "Expandir menú" : "Colapsar menú"}
            aria-label={collapsed ? "Expandir menú" : "Colapsar menú"}
          >
            {collapsed ? <ChevronRightIcon /> : <ChevronLeftIcon />}
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto overflow-x-hidden p-2 space-y-0.5">
          <NavItem
            to="/admin"
            end
            icon={<HomeIcon />}
            label="Dashboard"
            badge={totalBadge}
            collapsed={collapsed}
          />

          <SectionLabel label="Gestión" collapsed={collapsed} />
          <NavItem to="/admin/users" icon={<UsersIcon />} label="Usuarios" collapsed={collapsed} />
          <NavItem to="/admin/invitations" icon={<InviteIcon />} label="Invitaciones" collapsed={collapsed} />
          {hasModule(MODULE_KEYS.TEAMS) && (
            <NavItem to="/admin/teams" icon={<TeamsIcon />} label="Equipos" collapsed={collapsed} />
          )}

          {(hasModule(MODULE_KEYS.SCHEDULING) || hasModule(MODULE_KEYS.EXCEL_PLANNING)) && (
            <SectionLabel label="Planificación" collapsed={collapsed} />
          )}
          {hasModule(MODULE_KEYS.SCHEDULING) && (
            <NavItem to="/admin/diensts" icon={<CalendarIcon />} label="Diensts" collapsed={collapsed} />
          )}
          {hasModule(MODULE_KEYS.SCHEDULING) && (
            <NavItem to="/admin/dienst-templates" icon={<TemplateIcon />} label="Plantillas" collapsed={collapsed} />
          )}
          {hasModule(MODULE_KEYS.EXCEL_PLANNING) && (
            <NavItem to="/admin/excel-planning" icon={<ExcelIcon />} label="Excel Planning" collapsed={collapsed} />
          )}

          <SectionLabel label="Operaciones" collapsed={collapsed} />
          {hasModule(MODULE_KEYS.WORKDAY) && (
            <NavItem
              to="/admin/summaries"
              icon={<ChecklistIcon />}
              label="Jornada"
              badge={summariesCount}
              collapsed={collapsed}
            />
          )}
          {hasModule(MODULE_KEYS.VACATION) && (
            <NavItem
              to="/admin/vacations"
              icon={<VacationIcon />}
              label="Vacaciones"
              badge={vacationsCount}
              collapsed={collapsed}
            />
          )}
          {hasModule(MODULE_KEYS.SICK_LEAVES) && (
            <NavItem
              to="/admin/sick-leaves"
              icon={<SickIcon />}
              label="Bajas"
              badge={sickCount}
              collapsed={collapsed}
            />
          )}
          {hasModule(MODULE_KEYS.PRAEMIEN) && (
            <NavItem
              to="/admin/praemien"
              icon={<PraemienIcon />}
              label="Prämien"
              badge={praemienCount}
              collapsed={collapsed}
            />
          )}
          {hasModule(MODULE_KEYS.MESSAGES) && (
            <NavItem
              to="/admin/messages"
              icon={<MessageIcon />}
              label="Mensajes"
              badge={messagesCount}
              collapsed={collapsed}
            />
          )}
          {hasModule(MODULE_KEYS.APPOINTMENTS) && (
            <NavItem
              to="/admin/appointments"
              icon={<AppointmentIcon />}
              label="Citas"
              badge={appointmentsCount}
              collapsed={collapsed}
            />
          )}
          {hasModule(MODULE_KEYS.MECHANICS) && (
            <NavItem
              to="/admin/mechanics"
              icon={<WrenchIcon />}
              label="Averías"
              badge={mechanicsCount}
              collapsed={collapsed}
            />
          )}

          <SectionLabel label="Recursos" collapsed={collapsed} />
          {hasModule(MODULE_KEYS.AMBULANCES) && (
            <NavItem to="/admin/ambulances" icon={<AmbulanceIcon />} label="Ambulancias" collapsed={collapsed} />
          )}
          {hasModule(MODULE_KEYS.HOSPITALS) && (
            <NavItem to="/admin/hospitals" icon={<HospitalIcon />} label="Hospitales" collapsed={collapsed} />
          )}
          {hasModule(MODULE_KEYS.PAYROLL) && (
            <NavItem to="/admin/payroll" icon={<PayrollIcon />} label="Nóminas" collapsed={collapsed} />
          )}
          {hasModule(MODULE_KEYS.DOCUMENTS) && (
            <NavItem to="/admin/payroll/docs" icon={<DocumentIcon />} label="Documentos" collapsed={collapsed} />
          )}
        </nav>
      </aside>

      {/* ── Content ─────────────────────────────────────────── */}
      <div className="flex-1 min-w-0 overflow-auto bg-slate-50/90 p-4 sm:p-6">
        <Outlet />
      </div>
    </div>
  );
}

// ─── Icons ────────────────────────────────────────────────────────────────────

function HomeIcon() {
  return (
    <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} className="w-[18px] h-[18px]">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 9.75L12 3l9 6.75M4.5 10.5V21h15V10.5" />
    </svg>
  );
}
function UsersIcon() {
  return (
    <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} className="w-[18px] h-[18px]">
      <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-1a4 4 0 00-5.356-3.779M9 20H4v-1a4 4 0 015.356-3.779M15 7a4 4 0 11-8 0 4 4 0 018 0zm6 3a3 3 0 11-6 0 3 3 0 016 0zM3 10a3 3 0 116 0 3 3 0 01-6 0z" />
    </svg>
  );
}
function InviteIcon() {
  return (
    <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} className="w-[18px] h-[18px]">
      <path strokeLinecap="round" strokeLinejoin="round" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
    </svg>
  );
}
function TeamsIcon() {
  return (
    <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} className="w-[18px] h-[18px]">
      <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" />
    </svg>
  );
}
function CalendarIcon() {
  return (
    <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} className="w-[18px] h-[18px]">
      <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
    </svg>
  );
}
function TemplateIcon() {
  return (
    <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} className="w-[18px] h-[18px]">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.375 19.5h17.25m-17.25 0a1.125 1.125 0 01-1.125-1.125M3.375 19.5h1.5C5.496 19.5 6 18.996 6 18.375m-3.75 0V5.625m0 12.75v-1.5c0-.621.504-1.125 1.125-1.125m0 0h17.25m0 0c.621 0 1.125.504 1.125 1.125M21 5.625v12.75M21 5.625A1.125 1.125 0 0019.875 4.5H4.125A1.125 1.125 0 003 5.625m18 0v1.5c0 .621-.504 1.125-1.125 1.125M3.375 8.25h17.25" />
    </svg>
  );
}
function ExcelIcon() {
  return (
    <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} className="w-[18px] h-[18px]">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
    </svg>
  );
}
function ChecklistIcon() {
  return (
    <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} className="w-[18px] h-[18px]">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}
function VacationIcon() {
  return (
    <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} className="w-[18px] h-[18px]">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v2.25m6.364.386l-1.591 1.591M21 12h-2.25m-.386 6.364l-1.591-1.591M12 18.75V21m-4.773-4.227l-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z" />
    </svg>
  );
}
function SickIcon() {
  return (
    <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} className="w-[18px] h-[18px]">
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.182 15.182a4.5 4.5 0 01-6.364 0M21 12a9 9 0 11-18 0 9 9 0 0118 0zM9.75 9.75c0 .414-.168.75-.375.75S9 10.164 9 9.75 9.168 9 9.375 9s.375.336.375.75zm-.375 0h.008v.015h-.008V9.75zm5.625 0c0 .414-.168.75-.375.75s-.375-.336-.375-.75.168-.75.375-.75.375.336.375.75zm-.375 0h.008v.015h-.008V9.75z" />
    </svg>
  );
}
function MessageIcon() {
  return (
    <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} className="w-[18px] h-[18px]">
      <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" />
    </svg>
  );
}
function AppointmentIcon() {
  return (
    <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} className="w-[18px] h-[18px]">
      <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5m-9-6h.008v.008H12v-.008zM12 15h.008v.008H12V15zm0 2.25h.008v.008H12v-.008zM9.75 15h.008v.008H9.75V15zm0 2.25h.008v.008H9.75v-.008zM7.5 15h.008v.008H7.5V15zm0 2.25h.008v.008H7.5v-.008zm6.75-4.5h.008v.008h-.008v-.008zm0 2.25h.008v.008h-.008V15zm0 2.25h.008v.008h-.008v-.008zm2.25-4.5h.008v.008H16.5v-.008zm0 2.25h.008v.008H16.5V15z" />
    </svg>
  );
}
function WrenchIcon() {
  return (
    <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} className="w-[18px] h-[18px]">
      <path strokeLinecap="round" strokeLinejoin="round" d="M11.42 15.17L17.25 21A2.652 2.652 0 0021 17.25l-5.877-5.877M11.42 15.17l2.496-3.03c.317-.384.74-.626 1.208-.766M11.42 15.17l-4.655 5.653a2.548 2.548 0 11-3.586-3.586l6.837-5.63m5.108-.233c.55-.164 1.163-.188 1.743-.14a4.5 4.5 0 004.486-6.336l-3.276 3.277a3.004 3.004 0 01-2.25-2.25l3.276-3.276a4.5 4.5 0 00-6.336 4.486c.091 1.076-.071 2.264-.904 2.95l-.102.085m-1.745 1.437L5.909 7.5H4.5L2.25 3.75l1.5-1.5L7.5 4.5v1.409l4.26 4.26m-1.745 1.437l1.745-1.437m6.615 8.206L15.75 15.75M4.867 19.125h.008v.008h-.008v-.008z" />
    </svg>
  );
}
function AmbulanceIcon() {
  return (
    <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} className="w-[18px] h-[18px]">
      <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 18.75a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 01-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h1.125c.621 0 1.129-.504 1.09-1.124a17.902 17.902 0 00-3.213-9.193 2.056 2.056 0 00-1.58-.86H14.25M16.5 18.75h-2.25m0-11.177v-.958c0-.568-.422-1.048-.987-1.106a48.554 48.554 0 00-10.026 0 1.106 1.106 0 00-.987 1.106v7.635m12-6.677v6.677m0 4.5v-4.5m0 0h-12" />
    </svg>
  );
}
function HospitalIcon() {
  return (
    <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} className="w-[18px] h-[18px]">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v6m3-3H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}
function PayrollIcon() {
  return (
    <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} className="w-[18px] h-[18px]">
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 01-.75.75h-.75m-6-3.75h.008v.008H12v-.008zM12 15h.008v.008H12V15zm0 2.25h.008v.008H12v-.008z" />
    </svg>
  );
}
function DocumentIcon() {
  return (
    <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} className="w-[18px] h-[18px]">
      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
    </svg>
  );
}
function PraemienIcon() {
  return (
    <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} className="w-[18px] h-[18px]">
      <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 18.75h-9m9 0a3 3 0 013 3h-15a3 3 0 013-3m9 0v-3.375c0-.621-.503-1.125-1.125-1.125h-.871M7.5 18.75v-3.375c0-.621.504-1.125 1.125-1.125h.872m5.007 0H9.497m5.007 0a7.454 7.454 0 01-.982-3.172M9.497 14.25a7.454 7.454 0 00.981-3.172M5.25 4.236c-.982.143-1.954.317-2.916.52A6.003 6.003 0 007.73 9.728M5.25 4.236V4.5c0 2.108.966 3.99 2.48 5.228M5.25 4.236V2.721C7.456 2.41 9.71 2.25 12 2.25c2.291 0 4.545.16 6.75.47v1.516M7.73 9.728a6.726 6.726 0 002.748 1.35m8.272-6.842V4.5c0 2.108-.966 3.99-2.48 5.228m2.48-5.492a46.32 46.32 0 012.916.52 6.003 6.003 0 01-5.395 4.972m0 0a6.726 6.726 0 01-2.749 1.35m0 0a6.772 6.772 0 01-3.044 0" />
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
