import {
  EmojiFetchError,
  EmojiNotFoundError,
  IncompatibleOptionsError,
  InvalidEmojiError,
  RasterizeError,
} from "./errors.ts";

export function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === "AbortError";
}

export function throwIfAborted(signal?: AbortSignal): void {
  if (!signal?.aborted) {
    return;
  }

  if (typeof signal.throwIfAborted === "function") {
    signal.throwIfAborted();
  }

  if (signal.reason instanceof Error) {
    throw signal.reason;
  }

  throw new DOMException("The operation was aborted.", "AbortError");
}

export function shouldTryNextSource(error: unknown): boolean {
  if (
    error instanceof InvalidEmojiError ||
    error instanceof IncompatibleOptionsError ||
    error instanceof RasterizeError ||
    isAbortError(error)
  ) {
    return false;
  }

  return (
    error instanceof EmojiNotFoundError ||
    error instanceof EmojiFetchError ||
    error instanceof TypeError ||
    (error instanceof Error && error.message.includes("fetch is not available"))
  );
}
