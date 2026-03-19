import { describe, it, expect } from "vitest";
import { renderHook } from "@testing-library/react";
import { useTripDraftValidation } from "./useTripDraftValidation";
import type { TripData } from "../domain/types/trip";

const baseTripData: TripData = {
  date: "2025-01-15",
  assignmentId: "a1",
  driver: "d1",
  medic: "m1",
  auftragNumber: "",
  patientName: "",
  fromAddress: "",
  toAddress: "",
  timeWarning: "08:00",
  timeAtHome: "08:15",
  timePickup: "08:30",
  timeArrival: "09:00",
  timeEnd: "09:15",
  kmStart: 100,
  kmEnd: 120,
  wasCancelled: false,
  cancelledAtPickup: false,
  countsTrip: 1,
  reports: "",
  countsForSummary: true,
};

describe("useTripDraftValidation", () => {
  it("returns no error initially when draft is valid", () => {
    const { result } = renderHook(
      ({ tripFormData, wasCancelled, anschlussActive, previousTripFormData }) =>
        useTripDraftValidation(
          tripFormData,
          wasCancelled,
          anschlussActive,
          previousTripFormData,
        ),
      {
        initialProps: {
          tripFormData: baseTripData,
          wasCancelled: false,
          anschlussActive: false,
          previousTripFormData: null,
        },
      },
    );

    expect(result.current.draftError).toBe("");
    expect(result.current.badField).toBeNull();
  });

  it("returns error when draft has invalid times", () => {
    const invalidData: TripData = {
      ...baseTripData,
      timeArrival: "09:00",
      timeEnd: "08:30",
    };

    const { result } = renderHook(
      ({ tripFormData, wasCancelled, anschlussActive, previousTripFormData }) =>
        useTripDraftValidation(
          tripFormData,
          wasCancelled,
          anschlussActive,
          previousTripFormData,
        ),
      {
        initialProps: {
          tripFormData: invalidData,
          wasCancelled: false,
          anschlussActive: false,
          previousTripFormData: null,
        },
      },
    );

    expect(result.current.draftError).toContain("hora LIBRE");
    expect(result.current.badField).toBe("timeEnd");
  });

  it("returns no error when wasCancelled is true even with invalid draft", () => {
    const invalidData: TripData = {
      ...baseTripData,
      timeEnd: "07:00",
    };

    const { result } = renderHook(
      ({ tripFormData, wasCancelled, anschlussActive, previousTripFormData }) =>
        useTripDraftValidation(
          tripFormData,
          wasCancelled,
          anschlussActive,
          previousTripFormData,
        ),
      {
        initialProps: {
          tripFormData: invalidData,
          wasCancelled: true,
          anschlussActive: false,
          previousTripFormData: null,
        },
      },
    );

    expect(result.current.draftError).toBe("");
    expect(result.current.badField).toBeNull();
  });

  it("updates error when draft changes from invalid to valid", () => {
    const invalidData: TripData = {
      ...baseTripData,
      timeEnd: "08:30",
    };

    const { result, rerender } = renderHook(
      ({ tripFormData, wasCancelled, anschlussActive, previousTripFormData }) =>
        useTripDraftValidation(
          tripFormData,
          wasCancelled,
          anschlussActive,
          previousTripFormData,
        ),
      {
        initialProps: {
          tripFormData: invalidData,
          wasCancelled: false,
          anschlussActive: false,
          previousTripFormData: null,
        },
      },
    );

    expect(result.current.draftError).not.toBe("");
    expect(result.current.badField).toBe("timeEnd");

    rerender({
      tripFormData: baseTripData,
      wasCancelled: false,
      anschlussActive: false,
      previousTripFormData: null,
    });

    expect(result.current.draftError).toBe("");
    expect(result.current.badField).toBeNull();
  });

  it("returns error for Anschluss when kmStart < previousTrip kmEnd", () => {
    const patient2Data: TripData = {
      ...baseTripData,
      kmStart: 80,
      kmEnd: 100,
    };
    const patient1Data: TripData = {
      ...baseTripData,
      kmStart: 100,
      kmEnd: 120,
    };

    const { result } = renderHook(
      ({ tripFormData, wasCancelled, anschlussActive, previousTripFormData }) =>
        useTripDraftValidation(
          tripFormData,
          wasCancelled,
          anschlussActive,
          previousTripFormData,
        ),
      {
        initialProps: {
          tripFormData: patient2Data,
          wasCancelled: false,
          anschlussActive: true,
          previousTripFormData: patient1Data,
        },
      },
    );

    expect(result.current.draftError).toContain("Anschluss");
    expect(result.current.badField).toBe("kmStart");
  });
});
