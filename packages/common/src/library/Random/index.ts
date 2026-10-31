/**
 * @see https://stackoverflow.com/questions/521295/seeding-the-random-number-generator-in-javascript
 */
function cyrb128(str: string): [number, number, number, number] {
  let h1 = 1779033703,
    h2 = 3144134277,
    h3 = 1013904242,
    h4 = 2773480762;
  for (let i = 0, k: number; i < str.length; i++) {
    k = str.charCodeAt(i);
    h1 = h2 ^ Math.imul(h1 ^ k, 597399067);
    h2 = h3 ^ Math.imul(h2 ^ k, 2869860233);
    h3 = h4 ^ Math.imul(h3 ^ k, 951274213);
    h4 = h1 ^ Math.imul(h4 ^ k, 2716044179);
  }
  h1 = Math.imul(h3 ^ (h1 >>> 18), 597399067);
  h2 = Math.imul(h4 ^ (h2 >>> 22), 2869860233);
  h3 = Math.imul(h1 ^ (h3 >>> 17), 951274213);
  h4 = Math.imul(h2 ^ (h4 >>> 19), 2716044179);
  // biome-ignore lint/complexity/noCommaOperator: using code as provided in source
  ((h1 ^= h2 ^ h3 ^ h4), (h2 ^= h1), (h3 ^= h1), (h4 ^= h1));
  return [h1 >>> 0, h2 >>> 0, h3 >>> 0, h4 >>> 0];
} /**
 * @see https://stackoverflow.com/questions/521295/seeding-the-random-number-generator-in-javascript
 */
function sfc32(a: number, b: number, c: number, d: number) {
  return () => {
    a |= 0;
    b |= 0;
    c |= 0;
    d |= 0;
    const t = (((a + b) | 0) + d) | 0;
    d = (d + 1) | 0;
    a = b ^ (b >>> 9);
    b = (c + (c << 3)) | 0;
    c = (c << 21) | (c >>> 11);
    c = (c + t) | 0;
    return (t >>> 0) / 4294967296;
  };
}

/**
 * Random helpers that can be seeded. With a seed, the same seed always gives
 * the same sequence of results, which is useful for repeatable worlds or tests.
 *
 * For unseeded use, import the default `Random` instance instead.
 *
 * @see {@link https://arclockproject.org/docs/common/library/Random Guide} | {@link https://arclockproject.org/docs/api/common/library/Random API}
 * @example
 * const a = new SeededRandom("level-1");
 * const b = new SeededRandom("level-1");
 * a.rangeInt(0, 100) === b.rangeInt(0, 100); // true
 */
class SeededRandom {
  /**
   * Returns the next random float, from 0 up to but not including 1.
   *
   * Every call moves a seeded generator forward, so calling it once and ignoring
   * the result is a way to skip ("re-roll") a value.
   *
   * @returns Float in the range [0, 1).
   */
  random: () => number = Math.random;
  /**
   * Creates a generator. The same seed always gives the same numbers, in the same order.
   *
   * @param seed Any string. Without one (or with `""`), `Math.random()` is used
   * and results are not repeatable.
   */
  constructor(seed?: string) {
    if (seed) {
      this.random = sfc32(...cyrb128(seed));
    }
  }
  /**
   * Returns a random integer from `start` up to but not including `end`.
   *
   * @param start Lowest possible result.
   * @param end Upper limit, never returned.
   * @returns Integer in the range [start, end).
   * @example
   * Random.rangeInt(0, 5); // 0, 1, 2, 3 or 4
   */
  rangeInt(start: number, end: number): number {
    return Math.floor(start + this.random() * end);
  }
  /**
   * Returns a random float from `start` up to but not including `end`.
   *
   * @param start Lowest possible result.
   * @param end Upper limit, never returned.
   * @returns Float in the range [start, end).
   * @example
   * Random.rangeFloat(0, 5); // e.g. 3.666, never 5
   */
  rangeFloat(start: number, end: number): number {
    return start + this.random() * end;
  }
  /**
   * Picks a random element of `array`.
   *
   * @param array Array to pick from. If it is empty, `undefined` is returned.
   * @returns One of the elements.
   * @example
   * Random.fromArray(["rock", "paper", "scissors"]); // e.g. "paper"
   */
  fromArray<k>(array: k[]): k {
    return array[this.fromArrayIndex(array)]!;
  }
  /**
   * Picks a random index of `array`.
   *
   * @param array Array to pick an index from.
   * @returns Integer from 0 up to but not including `array.length`.
   * @example
   * Random.fromArrayIndex(["rock", "paper", "scissors"]); // e.g. 2
   */
  fromArrayIndex<k>(array: k[]): number {
    return this.rangeInt(0, array.length);
  }
  /**
   * Picks a random element of `array` together with its index.
   *
   * @param array Array to pick from.
   * @returns `[element, index]`.
   * @example
   * Random.fromArrayWithIndex(["rock", "paper", "scissors"]); // e.g. ["scissors", 2]
   */
  fromArrayWithIndex<k>(array: k[]): [k, number] {
    const i = this.fromArrayIndex(array);
    return [array[i]!, i];
  }
}
/**
 * Shared unseeded `SeededRandom`, backed by `Math.random()`. Results differ on every run.
 *
 * @see {@link https://arclockproject.org/docs/common/library/Random Guide} | {@link https://arclockproject.org/docs/api/common/library/Random API}
 * @example
 * import Random from "@arclockproject/common/library/Random";
 *
 * Random.rangeInt(0, 6) + 1; // dice roll, 1 to 6
 */
const Random: SeededRandom = new SeededRandom();
export default Random;
export { SeededRandom };
