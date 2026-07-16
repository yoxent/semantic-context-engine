export type LogLevel = "silent" | "error" | "warn" | "info" | "debug";

const LEVEL_ORDER: Record<LogLevel, number> = {
  silent: 0,
  error: 1,
  warn: 2,
  info: 3,
  debug: 4
};

export interface Logger {
  readonly level: LogLevel;
  error(message: string, fields?: Record<string, unknown>): void;
  warn(message: string, fields?: Record<string, unknown>): void;
  info(message: string, fields?: Record<string, unknown>): void;
  debug(message: string, fields?: Record<string, unknown>): void;
  child(fields: Record<string, unknown>): Logger;
}

export interface CreateLoggerOptions {
  level: LogLevel;
  /** Defaults to stderr. Injected in tests. */
  sink?: (line: string) => void;
  /** Merged into every log line. */
  defaults?: Record<string, unknown>;
}

export function createLogger(options: CreateLoggerOptions): Logger {
  const sink = options.sink ?? ((line: string) => process.stderr.write(`${line}\n`));
  const defaults = options.defaults ?? {};

  const emit = (level: Exclude<LogLevel, "silent">, message: string, fields?: Record<string, unknown>) => {
    if (LEVEL_ORDER[options.level] < LEVEL_ORDER[level]) return;
    const entry = {
      level,
      message,
      ...defaults,
      ...(fields ?? {})
    };
    sink(JSON.stringify(entry));
  };

  return {
    level: options.level,
    error: (message, fields) => emit("error", message, fields),
    warn: (message, fields) => emit("warn", message, fields),
    info: (message, fields) => emit("info", message, fields),
    debug: (message, fields) => emit("debug", message, fields),
    child(fields) {
      return createLogger({
        level: options.level,
        sink,
        defaults: { ...defaults, ...fields }
      });
    }
  };
}

/** CLI `--verbose` raises the effective level to at least `debug`. */
export function effectiveLogLevel(configLevel: LogLevel, verbose: boolean): LogLevel {
  if (!verbose) return configLevel;
  return LEVEL_ORDER[configLevel] >= LEVEL_ORDER.debug ? configLevel : "debug";
}
