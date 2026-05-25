import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { subscribeMessagesChanged } from "./messageEvents";

describe("messageEvents", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "BroadcastChannel",
      class MockBroadcastChannel {
        static instances: MockBroadcastChannel[] = [];
        onmessage: ((ev: MessageEvent) => void) | null = null;
        constructor(_name: string) {
          MockBroadcastChannel.instances.push(this);
        }
        postMessage(data: unknown) {
          for (const instance of MockBroadcastChannel.instances) {
            if (instance === this) continue;
            instance.onmessage?.({ data } as MessageEvent);
          }
        }
        close() {}
      },
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("emitMessagesChanged notifica a suscriptores cross-tab", () => {
    const handler = vi.fn();
    const unsubscribe = subscribeMessagesChanged(handler);

    const bcClass = BroadcastChannel as unknown as {
      instances: Array<{ onmessage: ((ev: MessageEvent) => void) | null }>;
    };
    const instance = bcClass.instances[0];
    instance?.onmessage?.({
      data: {
        type: "messages-changed",
        ts: Date.now(),
        senderId: "other-tab-id",
      },
    } as MessageEvent);

    expect(handler).toHaveBeenCalled();
    unsubscribe();
  });

  it("subscribeMessagesChanged ignora eventos de la misma pestaña vía BroadcastChannel", () => {
    const handler = vi.fn();
    const unsubscribe = subscribeMessagesChanged(handler);

    const bcClass = BroadcastChannel as unknown as {
      instances: Array<{ onmessage: ((ev: MessageEvent) => void) | null }>;
    };
    const selfInstance = bcClass.instances[0];
    selfInstance?.onmessage?.({
      data: {
        type: "messages-changed",
        ts: Date.now(),
        senderId: sessionStorage.getItem("__msgs_sender_id__"),
      },
    } as MessageEvent);

    expect(handler).not.toHaveBeenCalled();
    unsubscribe();
  });
});
