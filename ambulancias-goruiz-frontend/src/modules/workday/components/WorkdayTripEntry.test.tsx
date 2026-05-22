import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import WorkdayTripEntry from "./WorkdayTripEntry";
import type { AssignedDayFull } from "../../diensts";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

const assignedDay = {
  driver: { name: "Ana", lastName: "García" },
  medic: { name: "Luis", lastName: "Pérez" },
} as AssignedDayFull;

const baseProps = {
  assignedDay,
  ambulances: [{ _id: "amb1", ambulanceNumber: "3", brand: "B", modelName: "M", licensePlate: "X" }],
  ambulanceId: "",
  setAmbulanceId: vi.fn(),
  ambulanceNumber: "",
  initialAmbulanceKm: "",
  setInitialAmbulanceKm: vi.fn(),
  vehicleConfirmed: false,
  formBlocked: false,
  onConfirmAmbulanceData: vi.fn(),
  tripFormData: {} as never,
  setTripFormData: vi.fn(),
  wasCancelled: false,
  setWasCancelled: vi.fn(),
  countsTrip: 1,
  setCountsTrip: vi.fn(),
  reports: "",
  setReports: vi.fn(),
  anschlussActive: false,
  onAddAnschluss: vi.fn(),
  onCancelAnschluss: vi.fn(),
  previousTripFormData: null,
  setPreviousTripFormData: vi.fn(),
  anschlussGuardRef: { current: false },
  onSaveAnschlussPatient1: vi.fn(),
  onFinishAnschluss: vi.fn(),
  draftError: "",
  badField: null,
  onSaveTrip: vi.fn(),
  timeWarningRef: { current: null },
  timeAtHomeRef: { current: null },
  timePickupRef: { current: null },
  timeArrivalRef: { current: null },
  timeEndRef: { current: null },
  kmStartRef: { current: null },
  kmEndRef: { current: null },
};

describe("WorkdayTripEntry ambulance selector", () => {
  afterEach(() => {
    cleanup();
  });

  it("muestra select cuando ambulanceSelectorHidden es false", () => {
    render(<WorkdayTripEntry {...baseProps} ambulanceSelectorHidden={false} />);
    expect(screen.getByRole("combobox", { name: "pages.workday.selectAmbulance.label" })).toBeTruthy();
  });

  it("muestra etiqueta bloqueada cuando ambulanceSelectorHidden es true", () => {
    render(
      <WorkdayTripEntry
        {...baseProps}
        ambulanceSelectorHidden={true}
        lockedAmbulanceLabel="AMB-3 desde planificación"
      />,
    );
    expect(screen.getByText("AMB-3 desde planificación")).toBeTruthy();
    expect(document.getElementById("workday-ambulance-readonly")).toBeTruthy();
    expect(document.getElementById("ambulanceId")).toBeNull();
  });
});
