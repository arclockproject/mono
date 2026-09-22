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
  (h1 ^= h2 ^ h3 ^ h4), (h2 ^= h1), (h3 ^= h1), (h4 ^= h1);
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
class SeededRandom {
  /**
   *
   * @returns Random Float between 0-1 (excludes 1 from possibilities)
   */
  random: () => number = Math.random;
  /**
   * If `seed` is not passed, `Math.random()` will be used instead. This will result in an
   * unpredictable generation of numbers.
   */
  constructor(seed?: string) {
    if (seed) {
      this.random = sfc32(...cyrb128(seed));
    }
  }
  /**
   *
   * @param start from and including start
   * @param end up to but not including end
   * @returns Random Integer between {start} - {end} (excludes end from possibilities)
   */
  rangeInt(start: number, end: number): number {
    return Math.floor(start + this.random() * end);
  }
  /**
   *
   * @param start from and including start
   * @param end up to but not including end
   * @returns Random Float between {start} - {end} (excludes end from possibilities)
   */
  rangeFloat(start: number, end: number): number {
    return start + this.random() * end;
  }
  fromArray<k>(array: k[]): k {
    return array[this.fromArrayIndex(array)]!;
  }
  fromArrayIndex<k>(array: k[]): number {
    return this.rangeInt(0, array.length);
  }
  fromArrayWithIndex<k>(array: k[]): [k, number] {
    const i = this.fromArrayIndex(array);
    return [array[i]!, i];
  }
}
const Random: SeededRandom = new SeededRandom();
export default Random;
export { SeededRandom };
