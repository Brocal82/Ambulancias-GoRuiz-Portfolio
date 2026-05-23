import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import AdminDashboard from "./AdminDashboard";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock("../hooks/useModules", () => ({
  useModules: vi.fn(),
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

import { useModules } from "../hooks/useModules";

describe("AdminDashboard mechanics module gating", () => {
  it("muestra tarjeta mechanics cuando el módulo está activo", () => {
    vi.mocked(useModules).mockReturnValue({
      hasModule: (key: string) => key === "mechanics",
      enabledModules: ["mechanics"],
    });

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
    vi.mocked(useModules).mockReturnValue({
      hasModule: () => false,
      enabledModules: [],
    });

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
