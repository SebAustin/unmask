import { describe, expect, it } from "vitest";
import { generateSafeWord } from "./safe-word";

describe("generateSafeWord", () => {
  it("produces three lowercase words with two different nouns", () => {
    for (let i = 0; i < 50; i++) {
      const words = generateSafeWord().split(" ");
      expect(words).toHaveLength(3);
      expect(words[1]).not.toBe(words[2]);
      expect(words.join(" ")).toMatch(/^[a-z ]+$/);
    }
  });

  it("is driven entirely by the injected randomness", () => {
    const sequence = [0, 0, 0, 1];
    let i = 0;
    expect(generateSafeWord(() => sequence[i++])).toBe("amber anchor badger");
  });
});
