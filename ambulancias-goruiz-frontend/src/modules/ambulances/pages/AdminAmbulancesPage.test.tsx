import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, cleanup } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import AdminAmbulancesPage from "./AdminAmbulancesPage";
import type { Ambulance } from "../domain/types";

const mockAmbulance: Ambulance = {
  _id: "a1",
  brand: "Mercedes",
  modelName: "Sprinter",
  licensePlate: "1234-ABC",
  ambulanceNumber: "7",
};

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock("../../../hooks/useAuth", () => ({
  useAuth: vi.fn(),
}));

vi.mock("../../../hooks/useModules", () => ({
  useModules: () => ({
    hasModule: () => true,
  }),
}));

vi.mock("../domain/api", () => ({
  getAllAmbulances: vi.fn(),
  createAmbulance: vi.fn(),
  updateAmbulance: vi.fn(),
  deleteAmbulance: vi.fn(),
}));

vi.mock("../../../utils/toast", () => ({
  toastT: {
    success: vi.fn(),
    error: vi.fn(),
    apiError: vi.fn(),
  },
}));

vi.mock("../../../utils/confirm", () => ({
  confirmAction: vi.fn(() => Promise.resolve(true)),
}));

import { useAuth } from "../../../hooks/useAuth";
import * as ambulancesApi from "../domain/api";

function renderPage() {
  return render(
    <MemoryRouter>
      <AdminAmbulancesPage />
    </MemoryRouter>,
  );
}

describe("AdminAmbulancesPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useAuth).mockReturnValue({
      token: "test-token",
      role: "admin",
    } as ReturnType<typeof useAuth>);
    vi.mocked(ambulancesApi.getAllAmbulances).mockResolvedValue([mockAmbulance]);
  });

  afterEach(() => {
    cleanup();
  });

  it("muestra estado de carga y luego la lista", async () => {
    renderPage();
    expect(screen.getByText("pages.ambulances.adminPage.loading")).toBeTruthy();
    await waitFor(() => {
      expect(screen.getByText("Mercedes")).toBeTruthy();
    });
  });

  it("muestra error si falla la carga", async () => {
    vi.mocked(ambulancesApi.getAllAmbulances).mockRejectedValue(new Error("fail"));
    renderPage();
    await waitFor(() => {
      expect(screen.getByText("pages.ambulances.adminPage.error")).toBeTruthy();
    });
  });

  it("muestra enlaces de jefe_mecanicos cuando el rol es jefe_mecanicos", async () => {
    vi.mocked(useAuth).mockReturnValue({
      token: "test-token",
      role: "jefe_mecanicos",
    } as ReturnType<typeof useAuth>);
    renderPage();
    await waitFor(() => {
      expect(screen.getByText("pages.mechanics.navToChiefHome")).toBeTruthy();
      expect(screen.getByText("pages.ambulances.navToMechanics")).toBeTruthy();
    });
  });
});
