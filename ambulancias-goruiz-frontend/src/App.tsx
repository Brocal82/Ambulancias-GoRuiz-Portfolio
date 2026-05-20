import { lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import AppLayout from "./layouts/AppLayout";
import AdminAppLayout from "./layouts/AdminAppLayout";
import AdminSidebarLayout from "./layouts/AdminSidebarLayout";
import SuperadminAppLayout from "./layouts/SuperadminAppLayout";
import SuperadminSidebarLayout from "./layouts/SuperadminSidebarLayout";
import { AuthProvider } from "./context/AuthProvider";
import RequireAuth from "./components/RequireAuth";
import RequireRole from "./components/RequireRole";
import RequireModule from "./components/RequireModule";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

// Layouts, guards and providers load eagerly (needed before auth resolves).
// All page components are lazy-loaded to reduce the initial bundle size.

// Páginas públicas
const Welcome = lazy(() => import("./pages/Welcome"));
const Login = lazy(() => import("./pages/Login"));
const Register = lazy(() => import("./pages/Register"));
const SuperadminDashboard = lazy(() => import("./pages/SuperadminDashboard"));
const AcceptInvitationPage = lazy(() => import("./modules/invitations/pages/AcceptInvitationPage"));
const AdminInvitationsPage = lazy(() => import("./modules/invitations/pages/AdminInvitationsPage"));

// Páginas trabajador
const WorkerDashboard = lazy(() => import("./pages/WorkerDashboard"));
const ProfilePage = lazy(() => import("./modules/users").then((m) => ({ default: m.ProfilePage })));
const WorkerDienstsPage = lazy(() => import("./modules/diensts/pages/WorkerDienstsPage"));
const WorkerPraemienPage = lazy(() => import("./modules/praemien/pages/WorkerPraemienPage"));
const WorkerVacationsPage = lazy(() => import("./modules/vacation/pages/WorkerVacationsPage"));
const WorkerMessagesPage = lazy(() => import("./modules/messages/pages/WorkerMessagesPage"));
const WorkerSickLeavesPage = lazy(() => import("./modules/sick/pages/WorkerSickLeavesPage"));
const MyWorkdayPage = lazy(() => import("./modules/workday").then((m) => ({ default: m.MyWorkdayPage })));
const WorkerHospitalsPage = lazy(() => import("./modules/hospitals").then((m) => ({ default: m.WorkerHospitalsPage })));
const WorkerAppointmentsPage = lazy(() => import("./modules/appointments").then((m) => ({ default: m.WorkerAppointmentsPage })));
const WorkerReportMechanicsPage = lazy(() => import("./modules/mechanics").then((m) => ({ default: m.WorkerReportMechanicsPage })));
const JefeMecanicosDashboardPage = lazy(() => import("./modules/mechanics").then((m) => ({ default: m.JefeMecanicosDashboardPage })));
const WorkerPayrollPage = lazy(() => import("./modules/payroll/pages/WorkerPayrollPage"));
const WorkerDocumentsPage = lazy(() => import("./modules/documents/pages/WorkerDocumentsPage"));
const WorkerExcelPlanningPage = lazy(() => import("./modules/excel-planning/pages/WorkerExcelPlanningPage"));

// Páginas admin
const AdminDashboard = lazy(() => import("./pages/AdminDashboard"));
const AdminUsersPage = lazy(() => import("./modules/users").then((m) => ({ default: m.AdminUsersPage })));
const AdminUserDetailDashboard = lazy(() => import("./modules/users/pages/AdminUserDetailDashboard"));
const SuperadminMfaSettingsPage = lazy(() => import("./modules/users/pages/SuperadminMfaSettingsPage"));
const AdminDienstsPage = lazy(() => import("./modules/diensts/pages/AdminDienstsPage"));
const AdminDienstTemplatesPage = lazy(() => import("./modules/dienstTemplates/pages/AdminDienstTemplatesPage"));
const AdminVacationsPage = lazy(() => import("./modules/vacation/pages/AdminVacationsPage"));
const AdminAmbulancesPage = lazy(() => import("./modules/ambulances/pages/AdminAmbulancesPage"));
const AdminMechanicsPage = lazy(() => import("./modules/mechanics").then((m) => ({ default: m.AdminMechanicsPage })));
const AdminHospitalsPage = lazy(() => import("./modules/hospitals").then((m) => ({ default: m.AdminHospitalsPage })));
const AdminAppointmentsPage = lazy(() => import("./modules/appointments").then((m) => ({ default: m.AdminAppointmentsPage })));
const AdminSummariesPage = lazy(() => import("./modules/workday").then((m) => ({ default: m.AdminSummariesPage })));
const AdminMessagesPage = lazy(() => import("./modules/messages/pages/AdminMessagesPage"));
const AdminSentMessages = lazy(() => import("./modules/messages/pages/AdminSentMessages"));
const AdminTeamsPage = lazy(() => import("./modules/teams/pages/AdminTeamsPage"));
const AdminSickLeavesPage = lazy(() => import("./modules/sick/pages/AdminSickLeavesPage"));
const AdminPraemienPage = lazy(() => import("./modules/praemien/pages/AdminPraemienPage"));
const AdminPayrollPage = lazy(() => import("./modules/payroll/pages/AdminPayrollPage"));
const PayrollYearHubPage = lazy(() => import("./modules/payroll/pages/PayrollYearHubPage"));
const AdminPayrollModuleHubPage = lazy(() => import("./modules/payroll/pages/AdminPayrollModuleHubPage"));
const AdminDocumentsPage = lazy(() => import("./modules/documents/pages/AdminDocumentsPage"));
const AdminExcelPlanningPage = lazy(() => import("./modules/excel-planning/pages/AdminExcelPlanningPage"));

// Páginas superadmin
const SuperadminCompaniesList = lazy(() => import("./modules/companies/pages/SuperadminCompaniesList"));
const SuperadminCompanyForm = lazy(() => import("./modules/companies/pages/SuperadminCompanyForm"));
const SuperadminCreateAdmin = lazy(() => import("./modules/companies/pages/SuperadminCreateAdmin"));
const SuperadminSecurityMonitoringPage = lazy(() => import("./modules/support-access/pages/SuperadminSecurityMonitoringPage"));
const SuperadminSupportAccessPage = lazy(() => import("./modules/support-access/pages/SuperadminSupportAccessPage"));
const SuperadminCompanyDetailPage = lazy(() => import("./modules/companies/pages/SuperadminCompanyDetailPage"));

function RedirectToCurrentPayrollMonth() {
  const d = new Date();
  return (
    <Navigate
      to={`/admin/payroll/month/${d.getFullYear()}/${d.getMonth() + 1}`}
      replace
    />
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Suspense fallback={<div className="p-4 text-slate-500">Cargando...</div>}>
        <Routes>
          {/* Rutas públicas */}
          <Route path="/" element={<Welcome />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/invitation/accept" element={<AcceptInvitationPage />} />

          {/* Rutas protegidas */}
          <Route element={<RequireAuth />}>
            {/* ? AppLayout montado una sola vez */}
            <Route element={<AppLayout />}>
              {/* Trabajador */}
              <Route path="/profile" element={<ProfilePage />} />
              <Route path="/worker" element={<WorkerDashboard />} />
              <Route element={<RequireModule name="scheduling" />}>
                <Route path="/dienst" element={<WorkerDienstsPage />} />
              </Route>
              <Route element={<RequireModule name="hospitals" />}>
                <Route path="/worker/hospitals" element={<WorkerHospitalsPage />} />
              </Route>
              <Route element={<RequireModule name="praemien" />}>
                <Route path="/worker/praemien" element={<WorkerPraemienPage />} />
              </Route>

              <Route element={<RequireModule name="vacation" />}>
                <Route path="/worker/vacations" element={<WorkerVacationsPage />} />
              </Route>
              <Route element={<RequireModule name="sick-leaves" />}>
                <Route path="/worker/sick-leaves" element={<WorkerSickLeavesPage />} />
              </Route>
              <Route element={<RequireModule name="messages" />}>
                <Route path="/worker/messages" element={<WorkerMessagesPage />} />
              </Route>
              <Route element={<RequireModule name="workday" />}>
                <Route path="/my-workday" element={<MyWorkdayPage />} />
              </Route>
              <Route element={<RequireModule name="mechanics" />}>
                <Route
                  path="/worker/report-issue"
                  element={<WorkerReportMechanicsPage />}
                />
              </Route>
              <Route element={<RequireRole role="jefe_mecanicos" />}>
                <Route
                  path="/mechanics/dashboard"
                  element={<JefeMecanicosDashboardPage />}
                />
              </Route>
              <Route element={<RequireModule name="mechanics" />}>
                <Route element={<RequireRole role={["mecanico", "jefe_mecanicos"]} />}>
                  <Route path="/mechanics" element={<AdminMechanicsPage />} />
                </Route>
              </Route>
              <Route element={<RequireModule name="ambulances" />}>
                <Route element={<RequireRole role="jefe_mecanicos" />}>
                  <Route
                    path="/mechanics/ambulances"
                    element={<AdminAmbulancesPage />}
                  />
                </Route>
              </Route>
              <Route element={<RequireModule name="appointments" />}>
                <Route path="/worker/appointments" element={<WorkerAppointmentsPage />} />
              </Route>
              <Route element={<RequireModule name="payroll" />}>
                <Route path="/worker/payroll" element={<WorkerPayrollPage />} />
              </Route>
              <Route element={<RequireModule name="documents" />}>
                <Route path="/worker/documents" element={<WorkerDocumentsPage />} />
              </Route>
              <Route element={<RequireModule name="excel-planning" />}>
                <Route
                  path="/worker/excel-planning"
                  element={<WorkerExcelPlanningPage />}
                />
              </Route>

            </Route>
          </Route>

          {/* Superadmin: layout dedicado (como admin) */}
          <Route element={<RequireAuth />}>
            <Route element={<RequireRole role="superadmin" />}>
              <Route element={<SuperadminAppLayout />}>
                <Route element={<SuperadminSidebarLayout />}>
                  <Route path="/superadmin" element={<SuperadminDashboard />} />
                  <Route path="/superadmin/companies" element={<SuperadminCompaniesList />} />
                  <Route path="/superadmin/companies/new" element={<SuperadminCompanyForm />} />
                  <Route path="/superadmin/companies/:id" element={<SuperadminCompanyDetailPage />} />
                  <Route path="/superadmin/companies/:id/edit" element={<SuperadminCompanyForm />} />
                  <Route
                    path="/superadmin/companies/:id/admin"
                    element={<SuperadminCreateAdmin />}
                  />
                  <Route
                    path="/superadmin/support-access"
                    element={<SuperadminSupportAccessPage />}
                  />
                  <Route
                    path="/superadmin/security-monitoring"
                    element={<SuperadminSecurityMonitoringPage />}
                  />
                  <Route
                    path="/superadmin/security-mfa"
                    element={<SuperadminMfaSettingsPage />}
                  />
                </Route>
              </Route>
            </Route>
          </Route>

          {/* Admin: layout propio a pantalla completa */}
          <Route element={<RequireAuth />}>
            <Route element={<RequireRole role="admin" />}>
              <Route element={<AdminAppLayout />}>
                <Route element={<AdminSidebarLayout />}>
                  <Route path="/admin" element={<AdminDashboard />} />
                  <Route path="/admin/users" element={<AdminUsersPage />} />
                  <Route path="/admin/invitations" element={<AdminInvitationsPage />} />
                  <Route element={<RequireModule name="scheduling" />}>
                    <Route path="/admin/diensts" element={<AdminDienstsPage />} />
                    <Route
                      path="/admin/dienst-templates"
                      element={<AdminDienstTemplatesPage />}
                    />
                  </Route>
                  <Route element={<RequireModule name="hospitals" />}>
                    <Route path="/admin/hospitals" element={<AdminHospitalsPage />} />
                  </Route>
                  <Route element={<RequireModule name="vacation" />}>
                    <Route path="/admin/vacations" element={<AdminVacationsPage />} />
                  </Route>
                  <Route element={<RequireModule name="messages" />}>
                    <Route path="/admin/messages" element={<AdminMessagesPage />} />
                    <Route path="/admin/messages/sent" element={<AdminSentMessages />} />
                  </Route>
                  <Route element={<RequireModule name="workday" />}>
                    <Route path="/admin/summaries" element={<AdminSummariesPage />} />
                  </Route>
                  <Route element={<RequireModule name="ambulances" />}>
                    <Route path="/admin/ambulances" element={<AdminAmbulancesPage />} />
                  </Route>
                  <Route path="/admin/user/:userId" element={<AdminUserDetailDashboard />} />
                  <Route element={<RequireModule name="mechanics" />}>
                    <Route path="/admin/mechanics" element={<AdminMechanicsPage />} />
                  </Route>
                  <Route element={<RequireModule name="appointments" />}>
                    <Route path="/admin/appointments" element={<AdminAppointmentsPage />} />
                  </Route>
                  <Route element={<RequireModule name="teams" />}>
                    <Route path="/admin/teams" element={<AdminTeamsPage />} />
                  </Route>
                  <Route element={<RequireModule name="sick-leaves" />}>
                    <Route path="/admin/sick-leaves" element={<AdminSickLeavesPage />} />
                  </Route>
                  <Route element={<RequireModule name="praemien" />}>
                    <Route path="/admin/praemien" element={<AdminPraemienPage />} />
                  </Route>
                  <Route element={<RequireModule name="payroll" />}>
                    <Route path="/admin/payroll" element={<AdminPayrollModuleHubPage />} />
                    <Route path="/admin/payroll/nominas" element={<PayrollYearHubPage />} />
                    <Route
                      path="/admin/payroll/month/:year/:month"
                      element={<AdminPayrollPage />}
                    />
                    <Route
                      path="/admin/payroll/month"
                      element={<RedirectToCurrentPayrollMonth />}
                    />
                  </Route>
                  <Route element={<RequireModule name="documents" />}>
                    <Route
                      path="/admin/payroll/docs"
                      element={<AdminDocumentsPage />}
                    />
                  </Route>
                  <Route element={<RequireModule name="excel-planning" />}>
                    <Route
                      path="/admin/excel-planning"
                      element={<AdminExcelPlanningPage />}
                    />
                  </Route>
                </Route>
              </Route>
            </Route>
          </Route>
        </Routes>
        </Suspense>

        <ToastContainer position="top-right" autoClose={3000} />
      </BrowserRouter>
    </AuthProvider>
  );
}


