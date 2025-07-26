// src/layouts/AppLayout.tsx
import type { ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";

interface AppLayoutProps {
  children: ReactNode;
}

export default function AppLayout({ children }: AppLayoutProps) {
  const { logout, role, user } = useAuth();
  
  const navigate = useNavigate();
  const isWorker = role === "worker";
  const isAdmin = role === "admin";

  const goHome = () => {
    if (isWorker) navigate("/worker");
    if (isAdmin) navigate("/admin");
  };
console.log("👤 Usuario en AppLayout:", user);

  return (
    <div className="min-h-screen bg-gray-100 text-gray-900">
      <header className="bg-blue-600 text-white p-4 shadow flex items-center justify-between">
        <div
          className="flex items-center gap-3 cursor-pointer transition-opacity hover:opacity-90 group"
          onClick={goHome}
          title="Ir a la página principal"
        >
          {/* ✅ Icono de casa con transición de color */}
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-6 w-6 text-white group-hover:text-blue-200 transition-colors duration-300"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M3 9.75L12 3l9 6.75M4.5 10.5V21h15v-10.5"
            />
          </svg>
          <h1 className="text-xl font-bold">Ambulancias Goruiz</h1>
        </div>

        <div className="flex items-center gap-4">
          {user && (
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium hidden sm:inline">
                {user.lastName}, {user.name}
              </span>
              <Link to="/profile" title="Perfil">
                <img
                  src={
                    user.profileImage
                      ? `http://localhost:5000${user.profileImage}`
                      : "https://cdn-icons-png.flaticon.com/512/149/149071.png"
                  }
                  alt="Perfil"
                  className="w-8 h-8 rounded-full hover:scale-105 transition-transform border border-white"
                  title="Ver perfil"
                />
              </Link>

            </div>
          )}

          <button
            onClick={logout}
            className="bg-red-500 hover:bg-red-600 text-white px-3 py-1 rounded text-sm"
          >
            Cerrar sesión
          </button>
        </div>
      </header>

      <main className="p-4">{children}</main>

      <footer className="bg-gray-200 text-center p-2 text-sm text-gray-600">
        &copy; 2025 Ambulancias Goruiz
      </footer>
    </div>
  );
}



