import { BrowserRouter, Routes, Route } from "react-router-dom";
import AppLayout from "./layouts/AppLayout";
import { AuthProvider } from "./context/AuthProvider";
import RequireAuth from "./components/RequireAuth";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

// Páginas públicas
import Welcome from "./pages/Welcome";
import Login from "./pages/Login";
import Register from "./pages/Register";

// Páginas privadas
import Profile from "./pages/Profile";
import WorkerDashboard from "./pages/WorkerDashboard";
import WorkerDienstsPage from "./pages/WorkerDienstsPage";
import WorkerHospitalsPage from "./pages/WorkerHospitalsPage";
import WorkerPraemienPage from "./pages/WorkerPraemienPage";
import WorkerVacationsPage from "./pages/WorkerVacationsPage";
import WorkerMessagesPage from "./pages/WorkerMessagesPage";
import WorkerAppointmentsPage from "./pages/WorkerAppointmentsPage";
import WorkerSickLeavesPage from "./pages/WorkerSickLeavesPage";
import MyWorkday from "./pages/MyWorkDay";

import AdminDashboard from "./pages/AdminDashboard";
import AdminUsersPage from "./pages/AdminUsersPage";
import AdminDienstsPage from "./pages/AdminDienstsPage";
import AdminDienstTemplatesPage from "./pages/AdminDienstTemplatesPage";
import AdminHospitalsPage from "./pages/AdminHospitalsPage";
import AdminVacationsPage from "./pages/AdminVacationsPage";
import AdminSummariesPage from "./pages/AdminSummariesPage";
import AdminAmbulancesPage from "./pages/AdminAmbulancesPage";
import AdminMechanicsPage from "./pages/AdminMechanicsPage";
import AdminUserDetailDashboard from "./pages/AdminUserDetailDashboard";
import AdminMessagesPage from "./pages/AdminMessagesPage";
import AdminSentMessages from "./pages/AdminSentMessages";
import AdminAppointmentsPage from "./pages/AdminAppointmentsPage";
import AdminTeamsPage from "./pages/AdminTeamsPage";
import AdminSickLeavesPage from "./pages/AdminSickLeavesPage";

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Rutas públicas */}
          <Route path="/" element={<Welcome />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />

          {/* Rutas protegidas */}
          <Route element={<RequireAuth />}>
            {/* ✅ AppLayout montado una sola vez */}
            <Route element={<AppLayout />}>
              {/* Trabajador */}
              <Route path="/profile" element={<Profile />} />
              <Route path="/worker" element={<WorkerDashboard />} />
              <Route path="/dienst" element={<WorkerDienstsPage />} />
              <Route path="/worker/hospitals" element={<WorkerHospitalsPage />} />
              <Route path="/worker/praemien" element={<WorkerPraemienPage />} />
              <Route path="/worker/vacations" element={<WorkerVacationsPage />} />
              <Route path="/worker/sick-leaves" element={<WorkerSickLeavesPage />} />
              <Route path="/worker/messages" element={<WorkerMessagesPage />} />
              <Route path="/my-workday" element={<MyWorkday />} />
              <Route path="/worker/appointments" element={<WorkerAppointmentsPage />} />

              {/* Admin */}
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
        </Routes>

        <ToastContainer position="top-right" autoClose={3000} />
      </BrowserRouter>
    </AuthProvider>
  );
}
