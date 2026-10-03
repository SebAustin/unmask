import { describe, expect, it } from "vitest";
import { safeIdentityName, verificationPlan } from "./plan";

describe("safeIdentityName", () => {
  it("keeps known brands and maps roles to generic nouns", () => {
    expect(safeIdentityName("PayPal Security Team")).toBe("PayPal");
    expect(safeIdentityName("your grandson Tommy")).toBe("your family member");
    expect(safeIdentityName("the CEO")).toBe("your employer");
    expect(safeIdentityName("IRS agent")).toBe("the IRS");
  });

  it("never lets phone numbers, links or emails through", () => {
    for (const hostile of ["Chase, call 1-800-555-0100", "Visit paypa1.com", "help@scam.top", "Totally Real Bank"]) {
      const name = safeIdentityName(hostile);
      expect(name ?? "").not.toMatch(/\d|\.com|\.top|@/);
    }
  });
});

describe("verificationPlan", () => {
  it("always starts by telling the user not to use contact details from the message", () => {
    const plan = verificationPlan("delivery", "USPS");
    expect(plan[0]).toMatch(/don't use any link, phone number or email in the message/i);
    expect(plan.join(" ")).toMatch(/USPS/);
  });

  it("gives family-specific advice for family emergencies", () => {
    expect(verificationPlan("family_emergency", "your grandson").join(" ")).toMatch(/safe word|number you already have/i);
  });

  it("never includes contact details smuggled into the claimed identity", () => {
    const plan = verificationPlan("bank", "Chase Bank, call 1-800-555-0100 or chase-verify.top").join(" ");
    expect(plan).not.toMatch(/555|chase-verify/);
  });

  it("returns a reassuring but careful plan when nothing looks wrong", () => {
    expect(verificationPlan("none", null).join(" ")).toMatch(/still/i);
  });
});
