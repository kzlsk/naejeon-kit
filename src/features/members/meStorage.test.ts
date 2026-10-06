import { beforeEach, describe, expect, it, vi } from "vitest";

import { clearMe, getMe, setMe } from "./meStorage";

describe("meStorage", () => {
  beforeEach(() => {
    const store = new Map<string, string>();
    vi.stubGlobal("localStorage", {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => store.set(k, v),
      removeItem: (k: string) => store.delete(k),
    });
  });

  it("member:{code} 에 { id, token } 을 저장·삭제한다", () => {
    setMe("ABC234", { id: "m1", token: "t1" });
    expect(localStorage.getItem("member:ABC234")).toBe(
      '{"id":"m1","token":"t1"}',
    );
    expect(getMe("ABC234")).toEqual({ id: "m1", token: "t1" });
    clearMe("ABC234");
    expect(getMe("ABC234")).toBeNull();
  });

  it("깨진 값은 없는 것으로 본다", () => {
    localStorage.setItem("member:ABC234", "{oops");
    expect(getMe("ABC234")).toBeNull();
    localStorage.setItem("member:ABC234", '{"id":"m1"}');
    expect(getMe("ABC234")).toBeNull();
  });

  it("localStorage 가 throw 해도 앱이 죽지 않는다", () => {
    vi.stubGlobal("localStorage", {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("blocked");
      },
      removeItem: () => {
        throw new Error("blocked");
      },
    });
    expect(() => setMe("X", { id: "a", token: "b" })).not.toThrow();
    expect(getMe("X")).toBeNull();
    expect(() => clearMe("X")).not.toThrow();
  });
});
