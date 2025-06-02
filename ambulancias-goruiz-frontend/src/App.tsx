import { BrowserRouter, Routes, Route } from 'react-router-dom';
import AppLayout from './layouts/AppLayout';
import Home from './pages/Home';
import Profile from './pages/Profile';
import DienstPage from './pages/DienstPage';
import Login from './pages/Login';
import Welcome from './pages/Welcome';
import Register from './pages/Register';
import AdminPage from './pages/AdminPage';
import WorkerPage from './pages/WorkerPage';
import { AuthProvider } from './context/AuthContext';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Welcome />} /> {/* ✅ Bienvenida */}
          <Route path="/login" element={<Login />} />    // 👉 para redirecciones explícitas

          <Route path="/register" element={<Register />} />

          <Route
            path="/home"
            element={
              <AppLayout>
                <Home />
              </AppLayout>
            }
          />

          <Route
            path="/profile"
            element={
              <AppLayout>
                <Profile />
              </AppLayout>
            }
          />


          <Route
            path="/dienst"
            element={
              <AppLayout>
                <DienstPage />
              </AppLayout>
            }
          />

          <Route
            path="/admin"
            element={
              <AppLayout>
                <AdminPage />
              </AppLayout>
            }
          />

          <Route
            path="/worker"
            element={
              <AppLayout>
                <WorkerPage />
              </AppLayout>
            }
          />
        </Routes>

        <ToastContainer position="top-right" autoClose={3000} />
      </BrowserRouter>
    </AuthProvider>
  );
}
