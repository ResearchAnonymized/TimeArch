/**
 * Lightweight, environment-aware logger.
 * Replaces scattered `console.log` calls across the codebase.
 *
 * Levels are filterable via `localStorage.LOG_LEVEL` (debug | info | warn | error | silent).
 * Defaults to `info` in production, `debug` in development.
 */
type Level = "debug" | "info" | "warn" | "error" | "silent";

const ORDER: Record<Level, number> = { debug: 10, info: 20, warn: 30, error: 40, silent: 99 };

function resolveLevel(): Level {
  try {
    const stored = typeof window !== "undefined" ? window.localStorage?.getItem("LOG_LEVEL") : null;
    if (stored && stored in ORDER) return stored as Level;
  } catch {
    /* ignore */
  }
  return import.meta.env?.DEV ? "debug" : "info";
}

let current: Level = resolveLevel();

function emit(level: Exclude<Level, "silent">, scope: string, args: unknown[]) {
  if (ORDER[level] < ORDER[current]) return;
  const prefix = `[${level.toUpperCase()}] [${scope}]`;
  // eslint-disable-next-line no-console
  (console[level] ?? console.log)(prefix, ...args);
}

export interface Logger {
  debug: (...args: unknown[]) => void;
  info: (...args: unknown[]) => void;
  warn: (...args: unknown[]) => void;
  error: (...args: unknown[]) => void;
  child: (scope: string) => Logger;
}

export function createLogger(scope: string): Logger {
  return {
    debug: (...a) => emit("debug", scope, a),
    info: (...a) => emit("info", scope, a),
    warn: (...a) => emit("warn", scope, a),
    error: (...a) => emit("error", scope, a),
    child: (child) => createLogger(`${scope}/${child}`),
  };
}

export const logger = createLogger("app");

export function setLogLevel(level: Level): void {
  current = level;
  try {
    window.localStorage?.setItem("LOG_LEVEL", level);
  } catch {
    /* ignore */
  }
}
