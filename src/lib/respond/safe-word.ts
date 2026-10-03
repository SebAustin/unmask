/** Short, concrete, easy-to-say words; no homophones or offensive terms. Generated client-side only (FR-11). */
const ADJECTIVES = [
  "amber", "brave", "calm", "crisp", "dusty", "fuzzy", "gentle", "golden", "happy", "humble", "jolly",
  "lucky", "mellow", "misty", "noble", "polite", "quiet", "rapid", "rosy", "rusty", "shiny", "silent",
  "silver", "snowy", "sunny", "swift", "tidy", "velvet", "windy", "zesty", "cozy", "bold", "cheerful",
  "frosty", "honest", "lively", "proud", "sleepy", "spicy", "sturdy",
] as const;
const NOUNS = [
  "anchor", "badger", "banjo", "beacon", "biscuit", "canoe", "cactus", "comet", "cricket", "falcon",
  "garden", "giraffe", "harbor", "kettle", "lantern", "lemon", "maple", "meadow", "mitten", "otter",
  "pebble", "pepper", "pickle", "pine", "pony", "puffin", "quilt", "rocket", "saddle", "teapot",
  "thimble", "tiger", "tulip", "walnut", "whistle", "willow", "zebra", "acorn", "button", "pretzel",
] as const;

export type RandomInt = (maxExclusive: number) => number;

export const cryptoRandomInt: RandomInt = (maxExclusive) => {
  const buffer = new Uint32Array(1);
  const limit = Math.floor(0x1_0000_0000 / maxExclusive) * maxExclusive;
  do crypto.getRandomValues(buffer);
  while (buffer[0] >= limit);
  return buffer[0] % maxExclusive;
};

/** e.g. "golden otter teapot" — ~64,000 combinations, memorable and easy to say on the phone. */
export function generateSafeWord(randomInt: RandomInt = cryptoRandomInt): string {
  const adjective = ADJECTIVES[randomInt(ADJECTIVES.length)];
  const first = NOUNS[randomInt(NOUNS.length)];
  let second = NOUNS[randomInt(NOUNS.length)];
  while (second === first) second = NOUNS[randomInt(NOUNS.length)];
  return `${adjective} ${first} ${second}`;
}
