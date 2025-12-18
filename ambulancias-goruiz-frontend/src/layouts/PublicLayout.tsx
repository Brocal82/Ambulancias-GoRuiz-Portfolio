import type { ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import LanguageSwitcher from "../components/ui/LanguageSwitcher";

interface PublicLayoutProps {
    children: ReactNode;
    backTo?: string;
    backLabel?: string;
    showBack?: boolean;
}

export default function PublicLayout({
    children,
    backTo = "/",
    backLabel = "⬅️ Volver",
    showBack = true,
}: PublicLayoutProps) {
    const navigate = useNavigate();

    return (
        <div className="min-h-screen flex flex-col bg-slate-100 text-slate-900">
            {/* Header público */}
            <header className="bg-slate-900 border-b border-slate-800">
                <div className="mx-auto max-w-6xl px-4 py-3 flex items-center justify-between">
                    {/* Izquierda: volver */}
                    <div>
                        {showBack && (
                            <button
                                onClick={() => navigate(backTo)}
                                className="text-sm font-medium text-slate-300 hover:text-white
                           transition-colors"
                            >
                                {backLabel}
                            </button>
                        )}
                    </div>

                    {/* Derecha: idiomas */}
                    <LanguageSwitcher />
                </div>
            </header>

            {/* Contenido */}
            <main className="flex-1 flex items-center justify-center px-4">
                {children}
            </main>

            {/* Footer */}
            <footer className="bg-slate-900 border-t border-slate-800">
                <div className="mx-auto max-w-6xl px-4 py-4 text-center text-xs text-slate-300">
                    &copy; 2025 Ambulancias Gorruiz
                </div>
            </footer>
        </div>
    );
}
