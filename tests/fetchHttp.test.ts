import { describe, expect, test, vi } from "vite-plus/test";
import {
  composeFetchSignal,
  isNotFoundStatus,
  isRetryableFetchError,
  isRetryableFetchStatus,
  sleep,
} from "../src/fetchHttp.ts";

describe("fetchHttp helpers", () => {
  test("treats 404 and 410 as not found", () => {
    expect(isNotFoundStatus(404)).toBe(true);
    expect(isNotFoundStatus(410)).toBe(true);
    expect(isNotFoundStatus(503)).toBe(false);
  });

  test("treats 429 and 5xx as retryable", () => {
    expect(isRetryableFetchStatus(429)).toBe(true);
    expect(isRetryableFetchStatus(500)).toBe(true);
    expect(isRetryableFetchStatus(502)).toBe(true);
    expect(isRetryableFetchStatus(503)).toBe(true);
    expect(isRetryableFetchStatus(504)).toBe(true);
    expect(isRetryableFetchStatus(404)).toBe(false);
  });

  test("treats network and missing fetch errors as retryable", () => {
    expect(isRetryableFetchError(new TypeError("Failed to fetch"))).toBe(true);
    expect(isRetryableFetchError(new Error("fetch is not available in this environment"))).toBe(
      true,
    );
    expect(isRetryableFetchError(new Error("other"))).toBe(false);
  });

  test("composeFetchSignal uses timeout, user signal, or both", () => {
    const userController = new AbortController();
    expect(composeFetchSignal(undefined, 1000).signal).toBeInstanceOf(AbortSignal);
    expect(composeFetchSignal(userController.signal, 1000).signal).toBeInstanceOf(AbortSignal);
    expect(composeFetchSignal(userController.signal, 0).signal).toBe(userController.signal);
    expect(composeFetchSignal(undefined, 0).signal).toBeInstanceOf(AbortSignal);
  });

  test("sleep resolves immediately for non-positive delays", async () => {
    await expect(sleep(0)).resolves.toBeUndefined();
    await expect(sleep(-1)).resolves.toBeUndefined();
  });

  test("sleep rejects when the signal aborts", async () => {
    const controller = new AbortController();
    controller.abort(new Error("cancelled"));
    await expect(sleep(1000, controller.signal)).rejects.toThrow("cancelled");
  });
});

describe("fetchSvg abort behavior", () => {
  test("does not try fallbacks after abort", async () => {
    const { fetchSvgText } = await import("../src/fetchSvg.ts");
    const controller = new AbortController();
    const fetchImpl = vi.fn(async () => {
      controller.abort();
      throw new DOMException("The operation was aborted.", "AbortError");
    }) as typeof fetch;

    await expect(
      fetchSvgText({
        emoji: "😀",
        fallbacks: ["openmoji"],
        fetch: fetchImpl,
        signal: controller.signal,
        cache: false,
      }),
    ).rejects.toMatchObject({ name: "AbortError" });

    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });
});
