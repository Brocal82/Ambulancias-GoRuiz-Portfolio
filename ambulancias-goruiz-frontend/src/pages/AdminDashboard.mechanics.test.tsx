import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock("../hooks/useAuth", () => ({
  useAuth: vi.fn(),
}));

vi.mock("../modules/admin-dashboard/hooks", () => ({
  useAdminDashboardCounts: () => ({
    counts: {
      vacations: 0,
      summaries: 0,
      appointments: 0,
      mechanics: 0,
      sickLeaves: 0,
      praemienManual: 0,
    },
    isLoading: false,
  }),
}));

import AdminDashboard from "./AdminDashboard";
import { useAuth } from "../hooks/useAuth";

describe("AdminDashboard mechanics module gating", () => {
  beforeEach(() => {
    vi.mocked(useAuth).mockReset();
  });

  afterEach(() => {
    cleanup();
  });

  it("muestra tarjeta mechanics cuando el módulo está activo", () => {
    vi.mocked(useAuth).mockReturnValue({
      enabledModules: ["mechanics"],
      role: "admin",
    } as unknown as ReturnType<typeof useAuth>);

    render(
      <MemoryRouter>
        <AdminDashboard />
      </MemoryRouter>,
    );

    const link = screen.getByRole("link", {
      name: /pages\.adminDashboard\.mechanics\.title/i,
    });
    expect(link.getAttribute("href")).toBe("/admin/mechanics");
  });

  it("oculta tarjeta mechanics cuando el módulo está desactivado", () => {
    vi.mocked(useAuth).mockReturnValue({
      enabledModules: [],
      role: "admin",
    } as unknown as ReturnType<typeof useAuth>);

    render(
      <MemoryRouter>
        <AdminDashboard />
      </MemoryRouter>,
    );

    expect(
      screen.queryByRole("link", {
        name: /pages\.adminDashboard\.mechanics\.title/i,
      }),
    ).toBeNull();
  });
});
