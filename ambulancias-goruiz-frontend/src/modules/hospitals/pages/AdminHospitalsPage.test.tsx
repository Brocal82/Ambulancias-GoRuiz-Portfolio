import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, fireEvent, cleanup } from "@testing-library/react";
import AdminHospitalsPage from "../pages/AdminHospitalsPage";
import type { Hospital } from "../domain/types";

const mockHospital: Hospital = {
  _id: "h1",
  name: "Hospital Test",
  address: "Calle 1",
  phone: "+34 111",
  specialties: ["Urgencias"],
  isOpen: true,
};

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock("../../../hooks/useAuth", () => ({
  useAuth: () => ({ token: "test-token" }),
}));

vi.mock("../hooks/useHospitalStatusChanged", () => ({
  useHospitalStatusChanged: () => {},
}));

vi.mock("../domain/fetch", () => ({
  fetchHospitals: vi.fn(),
}));

vi.mock("../domain/api", () => ({
  createHospital: vi.fn(),
  updateHospital: vi.fn(),
  deleteHospital: vi.fn(),
}));

vi.mock("../utils/hospitalEvents", () => ({
  emitHospitalStatusChanged: vi.fn(),
}));

vi.mock("../../../utils/toast", () => ({
  toastT: {
    success: vi.fn(),
    apiError: vi.fn(),
  },
}));

import { fetchHospitals } from "../domain/fetch";
import * as hospitalsApi from "../domain/api";
import { toastT } from "../../../utils/toast";

describe("AdminHospitalsPage mutations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(fetchHospitals).mockResolvedValue([mockHospital]);
    vi.stubGlobal("confirm", vi.fn(() => true));
  });

  afterEach(() => {
    cleanup();
  });

  it("carga hospitales y permite alternar estado", async () => {
    vi.mocked(hospitalsApi.updateHospital).mockResolvedValue({
      ...mockHospital,
      isOpen: false,
    });

    render(<AdminHospitalsPage />);

    await waitFor(() => {
      expect(screen.getByText("Hospital Test")).toBeTruthy();
    });

    const statusButtons = screen.getAllByRole("button", {
      name: "pages.hospitals.adminPage.status.closed",
    });
    fireEvent.click(statusButtons[0]);

    await waitFor(() => {
      expect(hospitalsApi.updateHospital).toHaveBeenCalledWith("h1", { isOpen: false });
      expect(toastT.success).toHaveBeenCalled();
    });
  });

  it("elimina hospital tras confirmación", async () => {
    vi.mocked(hospitalsApi.deleteHospital).mockResolvedValue(undefined);

    render(<AdminHospitalsPage />);

    await waitFor(() => {
      expect(screen.getByText("Hospital Test")).toBeTruthy();
    });

    fireEvent.click(
      screen.getByTitle("pages.hospitals.adminPage.actions.delete"),
    );

    await waitFor(() => {
      expect(hospitalsApi.deleteHospital).toHaveBeenCalledWith("h1");
      expect(toastT.success).toHaveBeenCalled();
    });
  });
});
