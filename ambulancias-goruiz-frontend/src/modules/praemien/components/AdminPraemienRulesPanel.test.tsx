import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, fireEvent, cleanup, within } from "@testing-library/react";
import { AdminPraemienRulesPanel } from "./AdminPraemienRulesPanel";
import type { PraemienRuleConfig } from "../domain/api";
import { DEFAULT_PRAEMIEN_RULES } from "../utils/praemienRuleFactory";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, unknown>) => {
      if (params) return `${key}:${JSON.stringify(params)}`;
      return key;
    },
  }),
}));

vi.mock("../domain/api", () => ({
  getPraemienRules: vi.fn(),
  updatePraemienRules: vi.fn(),
}));

vi.mock("../../../utils/toast", () => ({
  toastT: {
    success: vi.fn(),
    error: vi.fn(),
  },
  getApiErrorMessage: (_error: unknown, fallback: string) => fallback,
}));

vi.mock("../../../utils/confirm", () => ({
  confirmAction: vi.fn(() => Promise.resolve(true)),
}));

import { getPraemienRules, updatePraemienRules } from "../domain/api";
import { toastT } from "../../../utils/toast";
import * as praemienRuleValidity from "../utils/praemienRuleValidity";

const mockRules: PraemienRuleConfig = {
  ...DEFAULT_PRAEMIEN_RULES,
  rules: DEFAULT_PRAEMIEN_RULES.rules.map((rule) => ({ ...rule })),
};

function countRuleRows() {
  return screen.getAllByRole("row").length - 1;
}

function rulesListToggle() {
  return screen.getByLabelText(
    (label) =>
      typeof label === "string" && label.startsWith("pages.praemien.adminRules.toggleRulesList"),
  );
}

function toggleRuleCount() {
  return rulesListToggle().textContent?.trim() ?? "";
}

async function waitForRulesPanelLoaded(total = 3) {
  await waitFor(() => {
    expect(toggleRuleCount()).toBe(String(total));
  });
}

async function expandRulesList() {
  fireEvent.click(rulesListToggle());
  await waitFor(() => {
    expect(rulesListToggle().getAttribute("aria-expanded")).toBe("true");
  });
}

async function collapseRulesList() {
  fireEvent.click(rulesListToggle());
  await waitFor(() => {
    expect(rulesListToggle().getAttribute("aria-expanded")).toBe("false");
  });
}

describe("AdminPraemienRulesPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getPraemienRules).mockResolvedValue(mockRules);
    vi.mocked(updatePraemienRules).mockImplementation(async (payload) => payload);
  });

  afterEach(() => {
    cleanup();
  });

  it("shows loading then compact header with collapsed rules list", async () => {
    render(<AdminPraemienRulesPanel />);
    expect(screen.getByText("pages.praemien.adminRules.loading")).toBeTruthy();

    await waitForRulesPanelLoaded();

    expect(rulesListToggle().getAttribute("aria-expanded")).toBe("false");
    expect(screen.queryByText("15 a 20 km")).toBeNull();
    expect(screen.queryByText("pages.praemien.adminRules.defaultLogicHint")).toBeNull();
    expect(screen.queryByText("pages.praemien.adminRules.futureOnlyHint")).toBeNull();
    expect(screen.queryByText("pages.praemien.adminRules.subtitle")).toBeNull();
    expect(screen.queryByText(/rulesCounter/)).toBeNull();
    expect(screen.queryByText(/rulesTotal/)).toBeNull();
    expect(toggleRuleCount()).toBe("3");

    await expandRulesList();
    expect(screen.getByText("15 a 20 km")).toBeTruthy();
    expect(screen.getByText("pages.praemien.adminRules.table.conditions")).toBeTruthy();
    expect(screen.getAllByText("×1.5").length).toBeGreaterThan(0);
  });

  it("toggles rules list visibility from the counter chip", async () => {
    render(<AdminPraemienRulesPanel />);
    await waitForRulesPanelLoaded();

    expect(screen.queryByText("15 a 20 km")).toBeNull();

    await expandRulesList();
    expect(screen.getByText("15 a 20 km")).toBeTruthy();

    await collapseRulesList();
    expect(screen.queryByText("15 a 20 km")).toBeNull();
  });

  it("opens create modal while list remains collapsed", async () => {
    render(<AdminPraemienRulesPanel />);
    await waitForRulesPanelLoaded();

    fireEvent.click(
      screen.getByRole("button", { name: "pages.praemien.adminRules.addRule" }),
    );

    expect(screen.getByRole("dialog")).toBeTruthy();
    expect(rulesListToggle().getAttribute("aria-expanded")).toBe("false");
    expect(screen.queryByText("15 a 20 km")).toBeNull();
  });

  it("shows empty state when no rules", async () => {
    vi.mocked(getPraemienRules).mockResolvedValue({
      version: 1,
      rules: [],
      cancelledTripPolicy: "excludeUnlessCountsTrip",
    });

    render(<AdminPraemienRulesPanel />);

    await waitForRulesPanelLoaded(0);
    await expandRulesList();

    await waitFor(() => {
      expect(screen.getByText("pages.praemien.adminRules.empty")).toBeTruthy();
    });
  });

  it("shows load error state", async () => {
    vi.mocked(getPraemienRules).mockRejectedValue(new Error("fail"));

    render(<AdminPraemienRulesPanel />);

    await waitFor(() => {
      expect(screen.getByText("pages.praemien.adminRules.loadError")).toBeTruthy();
    });
  });

  it("does not render a global save button", async () => {
    render(<AdminPraemienRulesPanel />);

    await waitForRulesPanelLoaded();
    await expandRulesList();

    expect(screen.getByText("15 a 20 km")).toBeTruthy();
    expect(screen.queryByTitle("pages.praemien.adminRules.save")).toBeNull();
    expect(screen.queryByTitle("pages.praemien.adminRules.noChanges")).toBeNull();
  });

  it("renders shared create button and no rule-type selector outside modal", async () => {
    render(<AdminPraemienRulesPanel />);

    await waitForRulesPanelLoaded();

    expect(
      screen.getByRole("button", { name: "pages.praemien.adminRules.addRule" }),
    ).toBeTruthy();
    expect(screen.queryByRole("combobox")).toBeNull();
    expect(screen.queryByText("pages.praemien.adminRules.addNew")).toBeNull();
  });

  it("opens create modal with rule-type selector inside modal only", async () => {
    render(<AdminPraemienRulesPanel />);

    await waitForRulesPanelLoaded();

    expect(screen.queryByRole("combobox")).toBeNull();

    fireEvent.click(
      screen.getByRole("button", { name: "pages.praemien.adminRules.addRule" }),
    );

    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText("pages.praemien.adminRules.createRule")).toBeTruthy();
    expect(within(dialog).getByText("pages.praemien.adminRules.fields.type")).toBeTruthy();
    expect(within(dialog).getByRole("combobox")).toBeTruthy();
    expect(
      within(dialog).getByText("pages.praemien.adminRules.ruleTypes.weekdayPickupTime"),
    ).toBeTruthy();
  });

  it("opens create modal without changing rule count", async () => {
    render(<AdminPraemienRulesPanel />);

    await waitForRulesPanelLoaded();
    await expandRulesList();
    expect(countRuleRows()).toBe(3);

    fireEvent.click(
      screen.getByRole("button", { name: "pages.praemien.adminRules.addRule" }),
    );

    expect(screen.getByRole("dialog")).toBeTruthy();
    expect(screen.getByText("pages.praemien.adminRules.createRule")).toBeTruthy();
    expect(countRuleRows()).toBe(3);
    expect(updatePraemienRules).not.toHaveBeenCalled();
  });

  it("cancel create discards draft and does not persist", async () => {
    render(<AdminPraemienRulesPanel />);

    await waitForRulesPanelLoaded();
    await expandRulesList();
    expect(countRuleRows()).toBe(3);

    fireEvent.click(
      screen.getByRole("button", { name: "pages.praemien.adminRules.addRule" }),
    );

    const dialog = screen.getByRole("dialog");
    fireEvent.change(within(dialog).getByRole("textbox"), {
      target: { value: "Draft rule" },
    });

    fireEvent.click(
      within(dialog).getByRole("button", { name: "pages.praemien.adminRules.modalCancel" }),
    );

    await waitFor(() => {
      expect(screen.queryByRole("dialog")).toBeNull();
    });
    expect(countRuleRows()).toBe(3);
    expect(screen.queryByText("Draft rule")).toBeNull();
    expect(updatePraemienRules).not.toHaveBeenCalled();
  });

  it("save create persists full config and adds row", async () => {
    render(<AdminPraemienRulesPanel />);

    await waitForRulesPanelLoaded();

    fireEvent.click(
      screen.getByRole("button", { name: "pages.praemien.adminRules.addRule" }),
    );

    const dialog = screen.getByRole("dialog");
    fireEvent.change(within(dialog).getByRole("textbox"), {
      target: { value: "New km rule" },
    });

    fireEvent.click(within(dialog).getByTitle("pages.praemien.adminRules.modalSave"));

    await waitFor(() => {
      expect(updatePraemienRules).toHaveBeenCalledTimes(1);
    });

    const payload = vi.mocked(updatePraemienRules).mock.calls[0][0];
    expect(payload.version).toBe(1);
    expect(payload.cancelledTripPolicy).toBe("excludeUnlessCountsTrip");
    expect(payload.rules).toHaveLength(4);
    expect(payload.rules[3]).toMatchObject({
      type: "km",
      label: "New km rule",
      enabled: true,
    });
    expect(toastT.success).toHaveBeenCalled();
  });

  it("edit opens copied draft without mutating list until save", async () => {
    render(<AdminPraemienRulesPanel />);

    await waitForRulesPanelLoaded();
    await expandRulesList();

    fireEvent.click(screen.getAllByTitle("pages.praemien.adminRules.actions.edit")[0]);

    const dialog = screen.getByRole("dialog");
    expect(screen.getByText("pages.praemien.adminRules.editRule")).toBeTruthy();

    fireEvent.change(within(dialog).getByRole("textbox"), {
      target: { value: "Changed in draft" },
    });

    fireEvent.click(
      within(dialog).getByRole("button", { name: "pages.praemien.adminRules.modalCancel" }),
    );

    expect(screen.getByText("15 a 20 km")).toBeTruthy();
    expect(screen.queryByText("Changed in draft")).toBeNull();
    expect(updatePraemienRules).not.toHaveBeenCalled();
  });

  it("save edit persists replacement via updatePraemienRules", async () => {
    render(<AdminPraemienRulesPanel />);

    await waitForRulesPanelLoaded();
    await expandRulesList();

    const editButtons = screen.getAllByTitle("pages.praemien.adminRules.actions.edit");
    fireEvent.click(editButtons[0]);

    const dialog = screen.getByRole("dialog");
    fireEvent.change(within(dialog).getByRole("textbox"), {
      target: { value: "Updated km rule" },
    });

    fireEvent.click(within(dialog).getByTitle("pages.praemien.adminRules.modalSave"));

    await waitFor(() => {
      expect(updatePraemienRules).toHaveBeenCalledTimes(1);
    });

    const payload = vi.mocked(updatePraemienRules).mock.calls[0][0];
    expect(payload.rules[0]).toMatchObject({
      type: "km",
      label: "Updated km rule",
      minKm: 15,
      maxKm: 20,
      multiplier: 1.5,
    });
  });

  it("disable persists immediately without global save", async () => {
    render(<AdminPraemienRulesPanel />);

    await waitForRulesPanelLoaded();
    await expandRulesList();

    const disableButtons = screen.getAllByRole("button", {
      name: "pages.praemien.adminRules.actions.disableShort",
    });
    fireEvent.click(disableButtons[0]);

    await waitFor(() => {
      expect(updatePraemienRules).toHaveBeenCalledTimes(1);
    });

    const payload = vi.mocked(updatePraemienRules).mock.calls[0][0];
    expect(payload.rules[0].enabled).toBe(false);
    expect(payload.rules[0]).toMatchObject({
      type: "km",
      minKm: 15,
      maxKm: 20,
      multiplier: 1.5,
    });
  });

  it("remove persists immediately after confirmation", async () => {
    render(<AdminPraemienRulesPanel />);

    await waitForRulesPanelLoaded();
    await expandRulesList();
    expect(countRuleRows()).toBe(3);

    const deleteButtons = screen.getAllByTitle("pages.praemien.adminRules.actions.remove");
    fireEvent.click(deleteButtons[0]);

    await waitFor(() => {
      expect(updatePraemienRules).toHaveBeenCalledTimes(1);
    });

    const payload = vi.mocked(updatePraemienRules).mock.calls[0][0];
    expect(payload.rules).toHaveLength(2);
    expect(payload.rules.some((rule) => rule.label === "15 a 20 km")).toBe(false);
  });

  it("shows only the numeric rule count in the toggle control", async () => {
    vi.mocked(getPraemienRules).mockResolvedValue({
      version: 1,
      cancelledTripPolicy: "excludeUnlessCountsTrip",
      rules: Array.from({ length: 12 }, (_, index) => ({
        id: `rule-${index}`,
        type: "km" as const,
        label: `Rule ${index + 1}`,
        enabled: true,
        minKm: 0,
        maxKm: null,
        multiplier: 1,
      })),
    });

    render(<AdminPraemienRulesPanel />);

    await waitForRulesPanelLoaded(12);
    expect(toggleRuleCount()).toBe("12");
    expect(screen.queryByText(/rulesTotal/)).toBeNull();
  });

  it("opens modal editor for weekdayPickupTime rule", async () => {
    vi.mocked(getPraemienRules).mockResolvedValue({
      version: 1,
      cancelledTripPolicy: "excludeUnlessCountsTrip",
      rules: [
        {
          id: "pickup1",
          type: "weekdayPickupTime",
          label: "Pickup rule",
          enabled: true,
          weekdays: [1, 3],
          pickupTimeFrom: "08:00",
          pickupTimeTo: "10:00",
          multiplier: 1.5,
        },
      ],
    });

    render(<AdminPraemienRulesPanel />);

    await waitForRulesPanelLoaded(1);
    await expandRulesList();
    expect(screen.getByText("Pickup rule")).toBeTruthy();

    fireEvent.click(screen.getByTitle("pages.praemien.adminRules.actions.edit"));

    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText("pages.praemien.adminRules.fields.pickupFrom")).toBeTruthy();
    expect(within(dialog).getByText("pages.praemien.adminRules.fields.pickupTo")).toBeTruthy();
  });

  it("create after editing another rule opens a clean default draft", async () => {
    render(<AdminPraemienRulesPanel />);

    await waitForRulesPanelLoaded();
    await expandRulesList();

    fireEvent.click(screen.getAllByTitle("pages.praemien.adminRules.actions.edit")[0]);
    const editDialog = screen.getByRole("dialog");
    fireEvent.change(within(editDialog).getByRole("textbox"), {
      target: { value: "Edited name only" },
    });
    fireEvent.click(
      within(editDialog).getByRole("button", { name: "pages.praemien.adminRules.modalCancel" }),
    );

    fireEvent.click(
      screen.getByRole("button", { name: "pages.praemien.adminRules.addRule" }),
    );

    const createDialog = screen.getByRole("dialog");
    expect((within(createDialog).getByRole("textbox") as HTMLInputElement).value).toBe("");
    const multiplierInput = within(createDialog).getByRole("spinbutton", {
      name: "pages.praemien.adminRules.fields.multiplier",
    }) as HTMLInputElement;
    expect(Number(multiplierInput.value)).toBe(1);
    expect(multiplierInput.step).toBe("0.5");
  });

  it("multiplier input uses 0.5 step in create modal", async () => {
    render(<AdminPraemienRulesPanel />);

    await waitForRulesPanelLoaded();

    fireEvent.click(
      screen.getByRole("button", { name: "pages.praemien.adminRules.addRule" }),
    );

    const dialog = screen.getByRole("dialog");
    const multiplierInput = within(dialog).getByRole("spinbutton", {
      name: "pages.praemien.adminRules.fields.multiplier",
    });
    expect((multiplierInput as HTMLInputElement).step).toBe("0.5");
  });

  it("blocks modal save when draft validation fails", async () => {
    render(<AdminPraemienRulesPanel />);

    await waitForRulesPanelLoaded();

    fireEvent.click(
      screen.getByRole("button", { name: "pages.praemien.adminRules.addRule" }),
    );

    const dialog = screen.getByRole("dialog");
    const saveButton = within(dialog).getByTitle("pages.praemien.adminRules.modalSave");
    expect(saveButton.hasAttribute("disabled")).toBe(true);

    fireEvent.click(saveButton);
    expect(updatePraemienRules).not.toHaveBeenCalled();
  });

  it("shows scheduled lifecycle badge for future start date", async () => {
    vi.spyOn(praemienRuleValidity, "getLocalTodayIsoDate").mockReturnValue("2026-06-01");

    vi.mocked(getPraemienRules).mockResolvedValue({
      version: 1,
      cancelledTripPolicy: "excludeUnlessCountsTrip",
      rules: [
        {
          id: "future",
          type: "km",
          label: "Future rule",
          enabled: true,
          minKm: 10,
          maxKm: null,
          multiplier: 2,
          effectiveFrom: "2027-01-01",
        },
      ],
    });

    render(<AdminPraemienRulesPanel />);

    await waitForRulesPanelLoaded(1);
    await expandRulesList();

    expect(screen.getByText("pages.praemien.adminRules.status.scheduled")).toBeTruthy();

    vi.restoreAllMocks();
  });

  it("saves rule with validity dates in payload", async () => {
    render(<AdminPraemienRulesPanel />);

    await waitForRulesPanelLoaded();

    fireEvent.click(
      screen.getByRole("button", { name: "pages.praemien.adminRules.addRule" }),
    );

    const dialog = screen.getByRole("dialog");
    fireEvent.change(within(dialog).getByRole("textbox"), {
      target: { value: "Scheduled km" },
    });
    const dateInputs = dialog.querySelectorAll('input[type="date"]');
    fireEvent.change(dateInputs[0], { target: { value: "2027-01-01" } });

    fireEvent.click(within(dialog).getByTitle("pages.praemien.adminRules.modalSave"));

    await waitFor(() => {
      expect(updatePraemienRules).toHaveBeenCalled();
    });

    const payload = vi.mocked(updatePraemienRules).mock.calls[
      vi.mocked(updatePraemienRules).mock.calls.length - 1
    ][0];
    const saved = payload?.rules.find((rule: { label?: string }) => rule.label === "Scheduled km");
    expect(saved?.effectiveFrom).toBe("2027-01-01");
    expect(saved?.effectiveTo ?? null).toBeNull();
  });

  it("renders validity dates in separate table columns", async () => {
    vi.mocked(getPraemienRules).mockResolvedValue({
      version: 1,
      cancelledTripPolicy: "excludeUnlessCountsTrip",
      rules: [
        {
          id: "dated",
          type: "km",
          label: "Dated rule",
          enabled: true,
          minKm: 0,
          maxKm: null,
          multiplier: 1,
          effectiveFrom: "2027-01-01",
          effectiveTo: "2027-12-31",
        },
        {
          id: "open-end",
          type: "km",
          label: "Open end rule",
          enabled: true,
          minKm: 0,
          maxKm: null,
          multiplier: 1,
          effectiveFrom: "2027-01-01",
        },
        {
          id: "legacy",
          type: "km",
          label: "Legacy rule",
          enabled: true,
          minKm: 0,
          maxKm: null,
          multiplier: 1,
        },
      ],
    });

    render(<AdminPraemienRulesPanel />);

    await waitForRulesPanelLoaded(3);
    await expandRulesList();
    expect(screen.getByText("Dated rule")).toBeTruthy();

    expect(screen.getByText("pages.praemien.adminRules.table.fromDate")).toBeTruthy();
    expect(screen.getByText("pages.praemien.adminRules.table.untilDate")).toBeTruthy();
    expect(screen.getAllByText("2027-01-01").length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText("2027-12-31")).toBeTruthy();
    expect(screen.getByText("pages.praemien.adminRules.table.noEndDate")).toBeTruthy();
    expect(screen.getAllByText("pages.praemien.adminRules.table.emptyCell").length).toBeGreaterThanOrEqual(2);
    expect(
      screen.queryByText('pages.praemien.adminRules.chips.fromDate:{"date":"2027-01-01"}'),
    ).toBeNull();
  });
});
