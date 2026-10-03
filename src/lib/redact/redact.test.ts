import { describe, expect, it } from "vitest";
import { redact } from "./redact";

describe("redact", () => {
  it("masks Luhn-valid card numbers but keeps the last four digits for context", () => {
    const { text, masks } = redact("Card 4111 1111 1111 1111 was charged");
    expect(text).toBe("Card [card ••••1111] was charged");
    expect(masks).toEqual([{ type: "card", replacement: "[card ••••1111]" }]);
  });

  it("leaves long digit runs that fail the Luhn check alone", () => {
    expect(redact("Order 1234 5678 9012 3456 shipped").text).toBe("Order 1234 5678 9012 3456 shipped");
  });

  it("masks SSNs, IBANs, bank accounts and routing numbers", () => {
    expect(redact("SSN 123-45-6789").text).toBe("SSN [SSN]");
    expect(redact("IBAN GB82WEST12345698765432 please").text).toBe("IBAN [IBAN] please");
    expect(redact("account number 000123456789").text).toBe("account number [account ••••6789]");
    expect(redact("routing 021000021").text).toBe("routing [routing number]");
  });

  it("masks one-time codes and passwords", () => {
    expect(redact("Your code is 482913.").text).toBe("Your code is [code].");
    expect(redact("482913 is your verification code").text).toBe("[code] is your verification code");
    expect(redact("my password: Hunter2!").text).toBe("my password: [password]");
    expect(redact("my password is Hunter2!").text).toBe("my password is [password]");
  });

  it("covers common real-world formats (SECURITY.md F-04)", () => {
    for (const value of [
      "password=hunter2", "pass: letmein", "SSN 123456789", "IBAN gb82 west 1234 5698 7654 32",
      "card 4111.1111.1111.1111", "acct 12345678", "a/c 98765432", "pin 1234", "CVV 123", "your code 482913",
    ]) {
      expect(redact(value).masks.length, value).toBeGreaterThan(0);
    }
  });

  it("never hides links or ordinary words after the word 'password'", () => {
    expect(redact("Reset password: paypa1-secure.com/login").text).toBe("Reset password: paypa1-secure.com/login");
    expect(redact("your password is https://paypa1.com").text).toBe("your password is https://paypa1.com");
    expect(redact("Your password is about to expire").text).toBe("Your password is about to expire");
  });

  it("never treats link or domain fragments as IBANs (robustness H-C)", () => {
    expect(redact("Visit pp12securelogin.com").text).toBe("Visit pp12securelogin.com");
    expect(redact("paypal.ab12verifyacct.ru").text).toBe("paypal.ab12verifyacct.ru");
    expect(redact("bit.ly/ab12cdEFghIJ").text).toBe("bit.ly/ab12cdEFghIJ");
    expect(redact("ab12 this that and more").text).toBe("ab12 this that and more");
  });

  it("does not mask boarding passes", () => {
    expect(redact("boarding pass: GATE 12").text).toBe("boarding pass: GATE 12");
  });

  it("never masks phone numbers, which are evidence the user needs to see", () => {
    const message = "Call +1 (800) 555-0100 or 202-555-0147 now";
    expect(redact(message).text).toBe(message);
  });

  it("masks at least 95% of a seeded mix of sensitive values", () => {
    const seeded = [
      "4111111111111111", "5500 0000 0000 0004", "3400 000000 00009", "123-45-6789",
      "GB82WEST12345698765432", "account no. 9876543210", "routing number 021000021",
      "code: 739204", "password is Tr0ub4dor&3", "6011-1111-1111-1117",
    ];
    const masked = seeded.filter((value) => redact(value).masks.length > 0);
    expect(masked.length / seeded.length).toBeGreaterThanOrEqual(0.95);
  });
});
