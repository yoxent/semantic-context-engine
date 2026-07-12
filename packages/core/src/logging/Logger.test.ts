import { describe, expect, it, vi } from "vitest";
import { createLogger, effectiveLogLevel, type LogLevel } from "./Logger.js";

describe("createLogger", () => {
  it("emits structured JSON lines at or above the configured level", () => {
    const lines: string[] = [];
    const logger = createLogger({
      level: "info",
      sink: (line) => lines.push(line)
    });

    logger.debug("skip me");
    logger.info("indexed", { files: 3, chunks: 7 });
    logger.warn("slow search", { elapsedMs: 40 });
    logger.error("boom", { code: "EFAIL" });

    expect(lines).toHaveLength(3);
    expect(JSON.parse(lines[0]!)).toEqual({
      level: "info",
      message: "indexed",
      files: 3,
      chunks: 7
    });
    expect(JSON.parse(lines[1]!).level).toBe("warn");
    expect(JSON.parse(lines[2]!).level).toBe("error");
  });

  it("stays silent when level is silent", () => {
    const sink = vi.fn();
    const logger = createLogger({ level: "silent", sink });
    logger.error("never");
    expect(sink).not.toHaveBeenCalled();
  });

  it("child logger merges default fields", () => {
    const lines: string[] = [];
    const logger = createLogger({ level: "debug", sink: (line) => lines.push(line) }).child({
      component: "indexing"
    });
    logger.debug("scan", { files: 2 });
    expect(JSON.parse(lines[0]!)).toMatchObject({
      level: "debug",
      message: "scan",
      component: "indexing",
      files: 2
    });
  });
});

describe("effectiveLogLevel", () => {
  it("keeps config level unless verbose forces debug", () => {
    expect(effectiveLogLevel("warn", false)).toBe("warn");
    expect(effectiveLogLevel("silent", true)).toBe("debug");
    expect(effectiveLogLevel("info", true)).toBe("debug");
  });

  it("does not lower an already higher level when verbose", () => {
    const levels: LogLevel[] = ["silent", "error", "warn", "info", "debug"];
    expect(levels.indexOf(effectiveLogLevel("debug", true))).toBe(levels.indexOf("debug"));
  });
});
