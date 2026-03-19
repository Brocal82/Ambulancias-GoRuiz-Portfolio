import { describe, it, expect } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useCloseDayModal } from "./useCloseDayModal";

describe("useCloseDayModal", () => {
  it("starts with all modals closed", () => {
    const { result } = renderHook(() => useCloseDayModal());

    expect(result.current.showCloseQuestion).toBe(false);
    expect(result.current.showReviewModal).toBe(false);
    expect(result.current.isFinalClosure).toBeNull();
  });

  it("openCloseQuestion shows the question modal", () => {
    const { result } = renderHook(() => useCloseDayModal());

    act(() => result.current.openCloseQuestion());

    expect(result.current.showCloseQuestion).toBe(true);
  });

  it("selectFinalClosure closes question and opens review modal", () => {
    const { result } = renderHook(() => useCloseDayModal());

    act(() => result.current.openCloseQuestion());
    act(() => result.current.selectFinalClosure());

    expect(result.current.showCloseQuestion).toBe(false);
    expect(result.current.showReviewModal).toBe(true);
    expect(result.current.isFinalClosure).toBe(true);
  });

  it("selectPartialClosure closes question and opens review modal", () => {
    const { result } = renderHook(() => useCloseDayModal());

    act(() => result.current.openCloseQuestion());
    act(() => result.current.selectPartialClosure());

    expect(result.current.showCloseQuestion).toBe(false);
    expect(result.current.showReviewModal).toBe(true);
    expect(result.current.isFinalClosure).toBe(false);
  });

  it("cancelCloseQuestion closes the question modal", () => {
    const { result } = renderHook(() => useCloseDayModal());

    act(() => result.current.openCloseQuestion());
    expect(result.current.showCloseQuestion).toBe(true);

    act(() => result.current.cancelCloseQuestion());
    expect(result.current.showCloseQuestion).toBe(false);
  });

  it("closeReviewModal closes the review modal", () => {
    const { result } = renderHook(() => useCloseDayModal());

    act(() => result.current.openCloseQuestion());
    act(() => result.current.selectFinalClosure());
    expect(result.current.showReviewModal).toBe(true);

    act(() => result.current.closeReviewModal());
    expect(result.current.showReviewModal).toBe(false);
  });
});
