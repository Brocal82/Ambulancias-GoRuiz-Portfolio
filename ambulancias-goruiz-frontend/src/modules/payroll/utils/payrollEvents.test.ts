import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { emitPayrollChanged, subscribePayrollChanged } from "./payrollEvents";

class MockBroadcastChannel {
  static instances: MockBroadcastChannel[] = [];
  onmessage: ((ev: MessageEvent) => void) | null = null;
  readonly name: string;
  constructor(name: string) {
    this.name = name;
    MockBroadcastChannel.instances.push(this);
  }
  postMessage(data: unknown) {
      for (const instance of MockBroadcastChannel.instances) {
        if (instance === this) continue;
        instance.onmessage?.({ data } as MessageEvent);
      }
    }
    close() {
      const idx = MockBroadcastChannel.instances.indexOf(this);
      if (idx !== -1) MockBroadcastChannel.instances.splice(idx, 1);
    }
}

describe("payrollEvents", () => {
  beforeEach(() => {
    MockBroadcastChannel.instances = [];
    vi.stubGlobal("BroadcastChannel", MockBroadcastChannel);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("subscribePayrollChanged fires handler on CustomEvent from same tab", () => {
    const handler = vi.fn();
    const unsubscribe = subscribePayrollChanged(handler);

    emitPayrollChanged();

    expect(handler).toHaveBeenCalled();
    unsubscribe();
  });

  it("subscribePayrollChanged fires handler on BroadcastChannel message from another tab", () => {
    const handler = vi.fn();
    const unsubscribe = subscribePayrollChanged(handler);

    const instance = MockBroadcastChannel.instances[0];
    instance?.onmessage?.({
      data: { type: "payroll-changed", ts: Date.now() },
    } as MessageEvent);

    expect(handler).toHaveBeenCalled();
    unsubscribe();
  });

  it("subscribePayrollChanged ignores BroadcastChannel messages with wrong type", () => {
    const handler = vi.fn();
    const unsubscribe = subscribePayrollChanged(handler);

    const instance = MockBroadcastChannel.instances[0];
    instance?.onmessage?.({
      data: { type: "documents-changed", ts: Date.now() },
    } as MessageEvent);

    expect(handler).not.toHaveBeenCalled();
    unsubscribe();
  });

  it("unsubscribe removes CustomEvent listener", () => {
    const handler = vi.fn();
    const unsubscribe = subscribePayrollChanged(handler);

    unsubscribe();
    emitPayrollChanged();

    expect(handler).not.toHaveBeenCalled();
  });

  it("subscribePayrollChanged fires handler on storage event", () => {
    const handler = vi.fn();
    const unsubscribe = subscribePayrollChanged(handler);

    const storageEvent = new StorageEvent("storage", {
      key: "__payroll_changed__",
      newValue: JSON.stringify({ ts: Date.now() }),
    });
    window.dispatchEvent(storageEvent);

    expect(handler).toHaveBeenCalled();
    unsubscribe();
  });

  it("subscribePayrollChanged ignores storage events with wrong key", () => {
    const handler = vi.fn();
    const unsubscribe = subscribePayrollChanged(handler);

    const storageEvent = new StorageEvent("storage", {
      key: "__documents_changed__",
      newValue: JSON.stringify({ ts: Date.now() }),
    });
    window.dispatchEvent(storageEvent);

    expect(handler).not.toHaveBeenCalled();
    unsubscribe();
  });

  it("multiple subscribers all receive the event", () => {
    const handlerA = vi.fn();
    const handlerB = vi.fn();
    const unsubA = subscribePayrollChanged(handlerA);
    const unsubB = subscribePayrollChanged(handlerB);

    emitPayrollChanged();

    expect(handlerA).toHaveBeenCalled();
    expect(handlerB).toHaveBeenCalled();
    unsubA();
    unsubB();
  });
});
