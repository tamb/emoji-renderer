import { describe, expect, test, vi } from "vite-plus/test";
import { isNotFoundStatus, isRetryableFetchStatus } from "../src/fetchHttp.ts";

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
