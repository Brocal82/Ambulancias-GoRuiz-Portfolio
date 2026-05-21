import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import HospitalsList from "./HospitalsList";
import type { Hospital } from "../domain/types";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

const hospitals: Hospital[] = [
  {
    _id: "h1",
    name: "Hospital Central",
    address: "Calle 1",
    phone: "+34 111",
    specialties: ["Urgencias"],
    isOpen: true,
  },
];

describe("HospitalsList", () => {
  afterEach(() => {
    cleanup();
  });

  it("modo worker no muestra acciones admin", () => {
    render(
      <HospitalsList
        hospitals={hospitals}
        mode="worker"
        onOpenDetails={vi.fn()}
      />,
    );

    expect(screen.getByText("Hospital Central")).toBeTruthy();
    expect(screen.queryByTitle("pages.hospitals.adminPage.actions.edit")).toBeNull();
    expect(screen.queryByTitle("pages.hospitals.adminPage.actions.delete")).toBeNull();
  });

  it("modo admin muestra acciones de edición y borrado", () => {
    render(
      <HospitalsList
        hospitals={hospitals}
        mode="admin"
        onOpenDetails={vi.fn()}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
      />,
    );

    expect(screen.getByTitle("pages.hospitals.adminPage.actions.edit")).toBeTruthy();
    expect(screen.getByTitle("pages.hospitals.adminPage.actions.delete")).toBeTruthy();
  });

  it("muestra estado de carga", () => {
    render(
      <HospitalsList
        hospitals={[]}
        mode="admin"
        isLoading
        onOpenDetails={vi.fn()}
      />,
    );

    expect(screen.getByRole("status").textContent).toContain(
      "pages.hospitals.adminPage.loading",
    );
  });

  it("muestra estado vacío", () => {
    render(
      <HospitalsList
        hospitals={[]}
        mode="worker"
        emptyMessage="Sin resultados"
        onOpenDetails={vi.fn()}
      />,
    );

    expect(screen.getByText("Sin resultados")).toBeTruthy();
  });

  it("deshabilita acciones cuando hay pendingHospitalId", () => {
    render(
      <HospitalsList
        hospitals={hospitals}
        mode="admin"
        pendingHospitalId="h1"
        onOpenDetails={vi.fn()}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
      />,
    );

    const editBtn = screen.getByTitle(
      "pages.hospitals.adminPage.actions.edit",
    ) as HTMLButtonElement;
    const deleteBtn = screen.getByTitle(
      "pages.hospitals.adminPage.actions.delete",
    ) as HTMLButtonElement;

    expect(editBtn.disabled).toBe(true);
    expect(deleteBtn.disabled).toBe(true);
  });
});
