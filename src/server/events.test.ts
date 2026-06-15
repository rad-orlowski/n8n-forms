import { describe, expect, it, vi } from "vitest";
import { publish, subscribe, type SseEvent } from "./events";

const event: SseEvent = { data: { ok: 1 }, resumeUrl: null, done: false };

describe("events registry", () => {
  it("delivers to a registered subscriber and reports true", () => {
    const push = vi.fn();
    subscribe("s1", push);
    expect(publish("s1", event)).toBe(true);
    expect(push).toHaveBeenCalledWith(event);
  });

  it("reports false when no subscriber is registered", () => {
    expect(publish("missing", event)).toBe(false);
  });

  it("stops delivering after unsubscribe", () => {
    const push = vi.fn();
    const off = subscribe("s2", push);
    off();
    expect(publish("s2", event)).toBe(false);
    expect(push).not.toHaveBeenCalled();
  });

  it("latest registration wins for the same session", () => {
    const first = vi.fn();
    const second = vi.fn();
    subscribe("s3", first);
    subscribe("s3", second);
    publish("s3", event);
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledWith(event);
  });

  it("a stale unsubscribe does not remove the newer subscriber", () => {
    const first = vi.fn();
    const second = vi.fn();
    const offFirst = subscribe("s4", first);
    subscribe("s4", second);
    offFirst(); // guard: must NOT evict `second`
    expect(publish("s4", event)).toBe(true);
    expect(second).toHaveBeenCalledWith(event);
  });
});
