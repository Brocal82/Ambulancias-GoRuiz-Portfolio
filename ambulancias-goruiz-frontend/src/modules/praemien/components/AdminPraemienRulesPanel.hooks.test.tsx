/**
 * Regression: the time-field editors combined two useFieldError() calls with `??`.
 * useFieldError calls useTranslation(), a real hook in react-i18next, so when the
 * first field got a validation issue the second call was skipped and React threw
 * "Rendered fewer hooks than expected". This file mocks useTranslation as a hook
 * (useState inside, like the real one) so hook-order changes actually surface.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { useState } from "react";
import { render, screen, waitFor, fireEvent, cleanup, within } from "@testing-library/react";
import { AdminPraemienRulesPanel } from "./AdminPraemienRulesPanel";
import type { PraemienRuleConfig } from "../domain/api";
import { DEFAULT_PRAEMIEN_RULES } from "../utils/praemienRuleFactory";

vi.mock("react-i18next", () => ({
  useTranslation: () => {
    useState(0);
    return {
      t: (key: string, params?: Record<string, unknown>) =>
        params ? `${key}:${JSON.stringify(params)}` : key,
    };
  },
}));

vi.mock("../domain/api", () => ({
  getPraemienRules: vi.fn(),
  updatePraemienRules: vi.fn(),
}));

vi.mock("../../../utils/toast", () => ({
  toastT: { success: vi.fn(), error: vi.fn() },
  getApiErrorMessage: (_error: unknown, fallback: string) => fallback,
}));

vi.mock("../../../utils/confirm", () => ({
  confirmAction: vi.fn(() => Promise.resolve(true)),
}));

import { getPraemienRules } from "../domain/api";

const mockRules: PraemienRuleConfig = {
  ...DEFAULT_PRAEMIEN_RULES,
  rules: DEFAULT_PRAEMIEN_RULES.rules.map((rule) => ({ ...rule })),
};

async function openCreateModalWithType(type: string) {
  render(<AdminPraemienRulesPanel />);
  const addButton = await screen.findByRole("button", {
    name: "pages.praemien.adminRules.addRule",
  });
  fireEvent.click(addButton);
  const dialog = screen.getByRole("dialog");
  fireEvent.change(within(dialog).getByRole("combobox"), { target: { value: type } });
  return dialog;
}

describe("AdminPraemienRulesPanel — time field validation keeps hook order stable", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getPraemienRules).mockResolvedValue(mockRules);
  });

  afterEach(() => {
    cleanup();
  });

  it("dienstStartTime: invalid start time shows the error without crashing", async () => {
    const dialog = await openCreateModalWithType("dienstStartTime");
    const from = within(dialog).getByLabelText("pages.praemien.adminRules.fields.dienstFrom");

    fireEvent.change(from, { target: { value: "" } });

    await waitFor(() => {
      expect(
        within(dialog).getAllByText("pages.praemien.adminRules.validation.invalidTime").length,
      ).toBeGreaterThan(0);
    });
    expect(screen.getByRole("dialog")).toBeTruthy();
  });

  it("weekdayPickupTime: invalid pickup time shows the error without crashing", async () => {
    const dialog = await openCreateModalWithType("weekdayPickupTime");
    const timeInputs = dialog.querySelectorAll<HTMLInputElement>('input[type="time"]');
    expect(timeInputs.length).toBeGreaterThanOrEqual(2);

    fireEvent.change(timeInputs[0], { target: { value: "" } });

    await waitFor(() => {
      expect(within(dialog).queryAllByText(/pages\.praemien\.adminRules\.validation\./).length)
        .toBeGreaterThan(0);
    });
    expect(screen.getByRole("dialog")).toBeTruthy();
  });
});
