// src/layouts/AppLayout.tsx
import type { ReactNode } from "react";

interface AppLayoutProps {
  children: ReactNode;
}

export default function AppLayout({ children }: AppLayoutProps) {
  return (
    <div className="min-h-screen bg-gray-100 text-gray-900">
      <header className="bg-blue-600 text-white p-4 shadow">
        <h1 className="text-xl font-bold">Ambulancias Goruiz</h1>
      </header>

      <main className="p-4">{children}</main>

      <footer className="bg-gray-200 text-center p-2 text-sm text-gray-600">
        &copy; 2025 Ambulancias Goruiz
      </footer>
    </div>
  );
}
