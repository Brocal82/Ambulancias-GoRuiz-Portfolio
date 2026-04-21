import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import AppLayout from "./layouts/AppLayout";
import { AuthProvider } from "./context/AuthProvider";
import RequireAuth from "./components/RequireAuth";
import RequireRole from "./components/RequireRole";
import RequireModule from "./components/RequireModule";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

// Páginas públicas
import Welcome from "./pages/Welcome";
import Login from "./pages/Login";
import Register from "./pages/Register";
import SuperadminDashboard from "./pages/SuperadminDashboard";
import AcceptInvitationPage from "./modules/invitations/pages/AcceptInvitationPage";
import AdminInvitationsPage from "./modules/invitations/pages/AdminInvitationsPage";

// Páginas privadas
import { ProfilePage } from "./modules/users";
import WorkerDashboard from "./pages/WorkerDashboard";
import WorkerDienstsPage from "./modules/diensts/pages/WorkerDienstsPage";
import WorkerPraemienPage from "./modules/praemien/pages/WorkerPraemienPage";
import WorkerVacationsPage from "./modules/vacation/pages/WorkerVacationsPage";
import WorkerMessagesPage from "./modules/messages/pages/WorkerMessagesPage";
import WorkerSickLeavesPage from "./modules/sick/pages/WorkerSickLeavesPage";
import { MyWorkdayPage, AdminSummariesPage } from "./modules/workday";
import {
  AdminHospitalsPage,
  WorkerHospitalsPage,
} from "./modules/hospitals";
import {
  AdminAppointmentsPage,
  WorkerAppointmentsPage,
} from "./modules/appointments";
import AdminDashboard from "./pages/AdminDashboard";
import { AdminUsersPage } from "./modules/users";
import AdminDienstsPage from "./modules/diensts/pages/AdminDienstsPage";
import AdminDienstTemplatesPage from "./modules/dienstTemplates/pages/AdminDienstTemplatesPage";
import AdminVacationsPage from "./modules/vacation/pages/AdminVacationsPage";
import AdminAmbulancesPage from "./modules/ambulances/pages/AdminAmbulancesPage";
import { AdminMechanicsPage } from "./modules/mechanics";
import AdminUserDetailDashboard from "./modules/users/pages/AdminUserDetailDashboard";
import AdminMessagesPage from "./modules/messages/pages/AdminMessagesPage";
import AdminSentMessages from "./modules/messages/pages/AdminSentMessages";
import AdminTeamsPage from "./modules/teams/pages/AdminTeamsPage";
import AdminSickLeavesPage from "./modules/sick/pages/AdminSickLeavesPage";
import AdminPayrollPage from "./modules/payroll/pages/AdminPayrollPage";
import PayrollYearHubPage from "./modules/payroll/pages/PayrollYearHubPage";
import AdminPayrollModuleHubPage from "./modules/payroll/pages/AdminPayrollModuleHubPage";
import AdminDocumentsPage from "./modules/documents/pages/AdminDocumentsPage";
import WorkerDocumentsPage from "./modules/documents/pages/WorkerDocumentsPage";
import WorkerPayrollPage from "./modules/payroll/pages/WorkerPayrollPage";

function RedirectToCurrentPayrollMonth() {
  const d = new Date();
  return (
    <Navigate
      to={`/admin/payroll/month/${d.getFullYear()}/${d.getMonth() + 1}`}
      replace
    />
  );
}
import SuperadminCompaniesList from "./modules/companies/pages/SuperadminCompaniesList";
import SuperadminCompanyForm from "./modules/companies/pages/SuperadminCompanyForm";
import SuperadminCreateAdmin from "./modules/companies/pages/SuperadminCreateAdmin";

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
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
              <Route path="/dienst" element={<WorkerDienstsPage />} />
              <Route element={<RequireModule name="hospitals" />}>
                <Route path="/worker/hospitals" element={<WorkerHospitalsPage />} />
              </Route>
              <Route path="/worker/praemien" element={<WorkerPraemienPage />} />
              <Route path="/worker/vacations" element={<WorkerVacationsPage />} />
              <Route path="/worker/sick-leaves" element={<WorkerSickLeavesPage />} />
              <Route element={<RequireModule name="messages" />}>
                <Route path="/worker/messages" element={<WorkerMessagesPage />} />
              </Route>
              <Route path="/my-workday" element={<MyWorkdayPage />} />
              <Route element={<RequireModule name="appointments" />}>
                <Route path="/worker/appointments" element={<WorkerAppointmentsPage />} />
              </Route>
              <Route element={<RequireModule name="payroll" />}>
                <Route path="/worker/payroll" element={<WorkerPayrollPage />} />
              </Route>
              <Route element={<RequireModule name="documents" />}>
                <Route path="/worker/documents" element={<WorkerDocumentsPage />} />
              </Route>

              <Route element={<RequireRole role="superadmin" />}>
                <Route path="/superadmin" element={<SuperadminDashboard />} />
                <Route path="/superadmin/companies" element={<SuperadminCompaniesList />} />
                <Route path="/superadmin/companies/new" element={<SuperadminCompanyForm />} />
                <Route
                  path="/superadmin/companies/:id/admin"
                  element={<SuperadminCreateAdmin />}
                />
                <Route path="/superadmin/companies/:id" element={<SuperadminCompanyForm />} />
              </Route>

              {/* Admin: protegido por rol */}
              <Route element={<RequireRole role="admin" />}>
                <Route path="/admin" element={<AdminDashboard />} />
                <Route path="/admin/users" element={<AdminUsersPage />} />
                <Route path="/admin/invitations" element={<AdminInvitationsPage />} />
                <Route path="/admin/diensts" element={<AdminDienstsPage />} />
                <Route path="/admin/dienst-templates" element={<AdminDienstTemplatesPage />} />
                <Route element={<RequireModule name="hospitals" />}>
                  <Route path="/admin/hospitals" element={<AdminHospitalsPage />} />
                </Route>
                <Route path="/admin/vacations" element={<AdminVacationsPage />} />
                <Route element={<RequireModule name="messages" />}>
                  <Route path="/admin/messages" element={<AdminMessagesPage />} />
                  <Route path="/admin/messages/sent" element={<AdminSentMessages />} />
                </Route>
                <Route path="/admin/summaries" element={<AdminSummariesPage />} />
                <Route path="/admin/ambulances" element={<AdminAmbulancesPage />} />
                <Route path="/admin/user/:userId" element={<AdminUserDetailDashboard />} />
                <Route path="/admin/mechanics" element={<AdminMechanicsPage />} />
                <Route element={<RequireModule name="appointments" />}>
                  <Route path="/admin/appointments" element={<AdminAppointmentsPage />} />
                </Route>
                <Route path="/admin/teams" element={<AdminTeamsPage />} />
                <Route path="/admin/sick-leaves" element={<AdminSickLeavesPage />} />
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
              </Route>
            </Route>
          </Route>
        </Routes>

        <ToastContainer position="top-right" autoClose={3000} />
      </BrowserRouter>
    </AuthProvider>
  );
}


