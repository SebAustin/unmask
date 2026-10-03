import { describe, expect, it } from "vitest";
import type { Signal } from "@/lib/domain/signal";
import { fuseVerdict } from "./fuse";

const signal = (id: string, severity: Signal["severity"]): Signal => ({
  id,
  severity,
  title: id,
  explanation: id,
});

describe("fuseVerdict", () => {
  it("trusts the model when there are no signals", () => {
    expect(fuseVerdict([], { riskScore: 12 })).toEqual({ riskScore: 12, label: "likely_safe" });
    expect(fuseVerdict([], { riskScore: 88 })).toEqual({ riskScore: 88, label: "scam" });
  });

  it("never lets the model talk a single hard signal down to Likely safe", () => {
    expect(fuseVerdict([signal("injection.instructions-to-ai", "hard")], { riskScore: 2 })).toEqual({
      riskScore: 50,
      label: "suspicious",
    });
  });

  it("calls it a Scam when two hard signals agree, or a hard and a high", () => {
    expect(fuseVerdict([signal("a", "hard"), signal("b", "hard")], { riskScore: 5 }).label).toBe("scam");
    expect(fuseVerdict([signal("a", "hard"), signal("b", "high")], { riskScore: 5 }).label).toBe("scam");
  });

  it("lifts any high signal to at least Suspicious", () => {
    expect(fuseVerdict([signal("text.secrecy", "high")], { riskScore: 0 }).label).toBe("suspicious");
  });

  it("adds severity weights and caps the score at 100", () => {
    const signals = [signal("a", "medium"), signal("b", "low")];
    expect(fuseVerdict(signals, { riskScore: 0 }).riskScore).toBe(20);
    const many = ["a", "b", "c"].map((id) => signal(id, "hard"));
    expect(fuseVerdict(many, null).riskScore).toBe(100);
  });

  it("counts a repeated signal id only once", () => {
    expect(fuseVerdict([signal("a", "medium"), signal("a", "medium")], null).riskScore).toBe(15);
  });

  it("scores from signals alone when the model is unavailable", () => {
    expect(fuseVerdict([], null)).toEqual({ riskScore: 0, label: "likely_safe" });
    expect(fuseVerdict([signal("a", "hard"), signal("b", "medium")], null)).toEqual({
      riskScore: 65,
      label: "suspicious",
    });
  });

  it("places the label boundaries at 35 and 70", () => {
    expect(fuseVerdict([], { riskScore: 34 }).label).toBe("likely_safe");
    expect(fuseVerdict([], { riskScore: 35 }).label).toBe("suspicious");
    expect(fuseVerdict([], { riskScore: 69 }).label).toBe("suspicious");
    expect(fuseVerdict([], { riskScore: 70 }).label).toBe("scam");
  });
});
