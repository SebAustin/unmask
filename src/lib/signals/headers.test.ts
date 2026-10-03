import { describe, expect, it } from "vitest";
import { parseHeaders, headerSignals } from "./headers";

const SPOOFED = `From: "PayPal Security" <service@paypa1-alerts.com>
Reply-To: help-desk@gmail.com
Return-Path: <bounce@mailer.example.net>
Authentication-Results: mx.google.com; spf=fail smtp.mailfrom=paypa1-alerts.com; dkim=none; dmarc=fail
Subject: Your account is limited`;

const LEGIT = `From: "GitHub" <noreply@github.com>
Reply-To: noreply@github.com
Return-Path: <bounces+123@em.github.com>
Authentication-Results: mx.google.com; spf=pass; dkim=pass; dmarc=pass`;

describe("parseHeaders", () => {
  it("reads display name, addresses and authentication results", () => {
    const headers = parseHeaders(SPOOFED);
    expect(headers.fromName).toBe("PayPal Security");
    expect(headers.fromDomain).toBe("paypa1-alerts.com");
    expect(headers.replyToDomain).toBe("gmail.com");
    expect(headers.auth).toEqual({ spf: "fail", dkim: "none", dmarc: "fail" });
  });
});

describe("headerSignals", () => {
  it("flags a brand display name sent from a domain the brand doesn't own", () => {
    const ids = headerSignals(parseHeaders(SPOOFED)).map((s) => s.id);
    expect(ids).toEqual(
      expect.arrayContaining([
        "header.display-name-brand-mismatch",
        "header.reply-to-mismatch",
        "header.auth-fail",
        "header.return-path-mismatch",
      ]),
    );
  });

  it("treats a normal bounce-domain Return-Path as low severity only", () => {
    const signals = headerSignals(parseHeaders(LEGIT));
    expect(signals.every((s) => s.severity === "low")).toBe(true);
  });
});

describe("headerSignals false-positive guards", () => {
  it("does not mistake a person named Chase for the bank", () => {
    const ids = headerSignals(parseHeaders('From: "Chase Miller" <chase.miller@gmail.com>')).map((s) => s.id);
    expect(ids).not.toContain("header.display-name-brand-mismatch");
  });

  it("still flags 'Chase Bank' from a stranger's domain", () => {
    const ids = headerSignals(parseHeaders('From: "Chase Bank Alerts" <alerts@chase-secure.top>')).map((s) => s.id);
    expect(ids).toContain("header.display-name-brand-mismatch");
  });

  it("accepts brands' real sending domains", () => {
    const ids = headerSignals(parseHeaders('From: "Facebook" <notification@facebookmail.com>')).map((s) => s.id);
    expect(ids).not.toContain("header.display-name-brand-mismatch");
  });
});
