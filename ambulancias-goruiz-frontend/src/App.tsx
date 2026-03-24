import { BrowserRouter, Routes, Route } from "react-router-dom";
import AppLayout from "./layouts/AppLayout";
import { AuthProvider } from "./context/AuthProvider";
import RequireAuth from "./components/RequireAuth";
import RequireRole from "./components/RequireRole";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

// Páginas públicas
import Welcome from "./pages/Welcome";
import Login from "./pages/Login";
import Register from "./pages/Register";
import SuperadminDashboard from "./pages/SuperadminDashboard";
import InvitationAcceptPlaceholder from "./pages/InvitationAcceptPlaceholder";

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

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Rutas públicas */}
          <Route path="/" element={<Welcome />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/invitation/accept" element={<InvitationAcceptPlaceholder />} />

          {/* Rutas protegidas */}
          <Route element={<RequireAuth />}>
            {/* ? AppLayout montado una sola vez */}
            <Route element={<AppLayout />}>
              {/* Trabajador */}
              <Route path="/profile" element={<ProfilePage />} />
              <Route path="/worker" element={<WorkerDashboard />} />
              <Route path="/dienst" element={<WorkerDienstsPage />} />
              <Route path="/worker/hospitals" element={<WorkerHospitalsPage />} />
              <Route path="/worker/praemien" element={<WorkerPraemienPage />} />
              <Route path="/worker/vacations" element={<WorkerVacationsPage />} />
              <Route path="/worker/sick-leaves" element={<WorkerSickLeavesPage />} />
              <Route path="/worker/messages" element={<WorkerMessagesPage />} />
              <Route path="/my-workday" element={<MyWorkdayPage />} />
              <Route path="/worker/appointments" element={<WorkerAppointmentsPage />} />

              <Route element={<RequireRole role="superadmin" />}>
                <Route path="/superadmin" element={<SuperadminDashboard />} />
              </Route>

              {/* Admin: protegido por rol */}
              <Route element={<RequireRole role="admin" />}>
                <Route path="/admin" element={<AdminDashboard />} />
                <Route path="/admin/users" element={<AdminUsersPage />} />
                <Route path="/admin/diensts" element={<AdminDienstsPage />} />
                <Route path="/admin/dienst-templates" element={<AdminDienstTemplatesPage />} />
                <Route path="/admin/hospitals" element={<AdminHospitalsPage />} />
                <Route path="/admin/vacations" element={<AdminVacationsPage />} />
                <Route path="/admin/messages" element={<AdminMessagesPage />} />
                <Route path="/admin/messages/sent" element={<AdminSentMessages />} />
                <Route path="/admin/summaries" element={<AdminSummariesPage />} />
                <Route path="/admin/ambulances" element={<AdminAmbulancesPage />} />
                <Route path="/admin/user/:userId" element={<AdminUserDetailDashboard />} />
                <Route path="/admin/mechanics" element={<AdminMechanicsPage />} />
                <Route path="/admin/appointments" element={<AdminAppointmentsPage />} />
                <Route path="/admin/teams" element={<AdminTeamsPage />} />
                <Route path="/admin/sick-leaves" element={<AdminSickLeavesPage />} />
              </Route>
            </Route>
          </Route>
        </Routes>

        <ToastContainer position="top-right" autoClose={3000} />
      </BrowserRouter>
    </AuthProvider>
  );
}


