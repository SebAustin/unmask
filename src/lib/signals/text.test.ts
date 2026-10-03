import { describe, expect, it } from "vitest";
import { textSignals } from "./text";

const ids = (text: string) => textSignals(text).map((s) => s.id);

describe("textSignals", () => {
  it("flags gift-card payment requests and quotes the exact words", () => {
    const text = "Hi, it's Mark. I need you to buy 5 Apple gift cards for a client today.";
    const signal = textSignals(text).find((s) => s.id === "text.gift-card-payment");
    expect(signal?.severity).toBe("high");
    expect(text).toContain(signal?.quote);
  });

  it("flags crypto, wire and P2P payment requests", () => {
    expect(ids("Send the fee in Bitcoin to this wallet address")).toContain("text.crypto-payment");
    expect(ids("Please pay via Zelle to avoid the late fee")).toContain("text.wire-p2p-payment");
  });

  it("flags urgency and threats of authority", () => {
    expect(ids("FINAL NOTICE: your account will be suspended within 24 hours")).toContain("text.urgency");
    expect(ids("A warrant has been issued for your arrest")).toContain("text.threat-authority");
  });

  it("flags requests to share a code, but not legitimate 'do not share' OTP messages", () => {
    expect(ids("Please read me the 6-digit code we just sent you")).toContain("text.credential-request");
    expect(ids("Your code is 482913. Do not share this code with anyone.")).not.toContain(
      "text.credential-request",
    );
  });

  it("does not flag real one-time-code messages that warn you never to share (robustness H-B)", () => {
    for (const legit of [
      "PayPal: 482913 is your security code. We will never ask you to share this code.",
      "Amazon will never ask you to send your password by email.",
      "We'll never ask you to tell us your PIN.",
      "Your bank will never phone you and ask you to give your code.",
    ]) {
      expect(ids(legit), legit).not.toContain("text.credential-request");
    }
  });

  it("isn't fooled by unrelated negations nearby", () => {
    expect(ids("Don't worry, just send me the code you got by text")).toContain("text.credential-request");
    expect(ids("Never mind the delay, send me the code now")).toContain("text.credential-request");
  });

  it("flags secrecy, remote access, prizes, job pay and guaranteed returns", () => {
    expect(ids("Keep this between us, don't tell your mom")).toContain("text.secrecy");
    expect(ids("Install AnyDesk so our technician can fix it")).toContain("text.remote-access");
    expect(ids("Congratulations, you have won a $1,000 prize!")).toContain("text.prize");
    expect(ids("Work from home and earn $500 per day, no experience needed")).toContain("text.job-pay");
    expect(ids("Guaranteed returns of 30% every month")).toContain("text.guaranteed-returns");
  });

  it("flags family-emergency and new-number scripts", () => {
    expect(ids("Hi mum, I lost my phone, this is my new number")).toContain("text.family-emergency");
    expect(ids("Grandma it's me, I was in an accident and need bail money")).toContain(
      "text.family-emergency",
    );
  });

  it("flags requests for money and secrecy from family", () => {
    expect(ids("Dad, something terrible happened, I need money right away, don't call mom")).toEqual(
      expect.arrayContaining(["text.money-request", "text.urgency", "text.secrecy"]),
    );
  });

  it("finds nothing alarming in an ordinary message", () => {
    expect(textSignals("Hey, are we still on for lunch Thursday at noon?")).toEqual([]);
  });

  it("reports each kind of signal once even when repeated", () => {
    expect(ids("urgent! URGENT! act now, urgent").filter((id) => id === "text.urgency")).toHaveLength(1);
  });
});
