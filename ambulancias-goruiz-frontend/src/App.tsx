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
            {/* Trabajador */}
            <Route
              path="/profile"
              element={
                <AppLayout>
                  <Profile />
                </AppLayout>
              }
            />
            <Route
              path="/worker"
              element={
                <AppLayout>
                  <WorkerDashboard />
                </AppLayout>
              }
            />
            <Route
              path="/dienst"
              element={
                <AppLayout>
                  <WorkerDienstsPage />
                </AppLayout>
              }
            />
            <Route
              path="/worker/hospitals"
              element={
                <AppLayout>
                  <WorkerHospitalsPage />
                </AppLayout>
              }
            />
            <Route
              path="/worker/praemien"
              element={
                <AppLayout>
                  <WorkerPraemienPage />
                </AppLayout>
              }
            />
            <Route
              path="/worker/vacations"
              element={
                <AppLayout>
                  <WorkerVacationsPage />
                </AppLayout>
              }
            />
            <Route
              path="/worker/sick-leaves"
              element={
                <AppLayout>
                  <WorkerSickLeavesPage />
                </AppLayout>
              }
            />
            <Route
              path="/worker/messages"
              element={
                <AppLayout>
                  <WorkerMessagesPage />
                </AppLayout>
              }
            />
            <Route
              path="/my-workday"
              element={
                <AppLayout>
                  <MyWorkday />
                </AppLayout>
              }
            />
            <Route
              path="/worker/appointments"
              element={
                <AppLayout>
                  <WorkerAppointmentsPage />
                </AppLayout>
              }
            />

            {/* Admin */}
            <Route
              path="/admin"
              element={
                <AppLayout>
                  <AdminDashboard />
                </AppLayout>
              }
            />
            <Route
              path="/admin/users"
              element={
                <AppLayout>
                  <AdminUsersPage />
                </AppLayout>
              }
            />
            <Route
              path="/admin/diensts"
              element={
                <AppLayout>
                  <AdminDienstsPage />
                </AppLayout>
              }
            />
            <Route
              path="/admin/dienst-templates"
              element={
                <AppLayout>
                  <AdminDienstTemplatesPage />
                </AppLayout>
              }
            />
            <Route
              path="/admin/hospitals"
              element={
                <AppLayout>
                  <AdminHospitalsPage />
                </AppLayout>
              }
            />
            <Route
              path="/admin/vacations"
              element={
                <AppLayout>
                  <AdminVacationsPage />
                </AppLayout>
              }
            />
            <Route
              path="/admin/messages"
              element={
                <AppLayout>
                  <AdminMessagesPage />
                </AppLayout>
              }
            />
            <Route
              path="/admin/messages/sent"
              element={
                <AppLayout>
                  <AdminSentMessages />
                </AppLayout>
              }
            />
            <Route
              path="/admin/summaries"
              element={
                <AppLayout>
                  <AdminSummariesPage />
                </AppLayout>
              }
            />
            <Route
              path="/admin/ambulances"
              element={
                <AppLayout>
                  <AdminAmbulancesPage />
                </AppLayout>
              }
            />
            <Route
              path="/admin/user/:userId"
              element={
                <AppLayout>
                  <AdminUserDetailDashboard />
                </AppLayout>
              }
            />
            <Route
              path="/admin/mechanics"
              element={
                <AppLayout>
                  <AdminMechanicsPage />
                </AppLayout>
              }
            />
            <Route
              path="/admin/appointments"
              element={
                <AppLayout>
                  <AdminAppointmentsPage />
                </AppLayout>
              }
            />
            <Route
              path="/admin/teams"
              element={
                <AppLayout>
                  <AdminTeamsPage />
                </AppLayout>
              }
            />
            <Route
              path="/admin/sick-leaves"
              element={
                <AppLayout>
                  <AdminSickLeavesPage />
                </AppLayout>
              }
            />
          </Route>
        </Routes>
        <ToastContainer position="top-right" autoClose={3000} />
      </BrowserRouter>
    </AuthProvider>
  );
}
