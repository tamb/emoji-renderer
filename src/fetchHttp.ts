export const DEFAULT_FETCH_TIMEOUT = 8000;
export const DEFAULT_FETCH_RETRIES = 2;

export function isNotFoundStatus(status: number): boolean {
  return status === 404 || status === 410;
}

export function isRetryableFetchStatus(status: number): boolean {
  return status === 429 || status === 500 || status === 502 || status === 503 || status === 504;
}

export function isRetryableFetchError(error: unknown): boolean {
  if (error instanceof TypeError) {
    return true;
  }

  return error instanceof Error && error.message.includes("fetch is not available");
}

export interface ComposedFetchSignal {
  signal: AbortSignal;
}

export function composeFetchSignal(
  userSignal: AbortSignal | undefined,
  timeoutMs: number,
): ComposedFetchSignal {
  if (timeoutMs <= 0 && userSignal) {
    return { signal: userSignal };
  }

  if (timeoutMs <= 0) {
    return { signal: new AbortController().signal };
  }

  const timeoutSignal = AbortSignal.timeout(timeoutMs);

  if (!userSignal) {
    return { signal: timeoutSignal };
  }

  return { signal: AbortSignal.any([userSignal, timeoutSignal]) };
}

export async function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  if (ms <= 0) {
    return;
  }

  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => {
      cleanup();
      resolve();
    }, ms);

    const onAbort = () => {
      cleanup();
      if (signal?.reason instanceof Error) {
        reject(signal.reason);
        return;
      }
      reject(new DOMException("The operation was aborted.", "AbortError"));
    };

    const cleanup = () => {
      clearTimeout(timer);
      signal?.removeEventListener("abort", onAbort);
    };

    if (signal?.aborted) {
      cleanup();
      onAbort();
      return;
    }

    signal?.addEventListener("abort", onAbort, { once: true });
  });
}
