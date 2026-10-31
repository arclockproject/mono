/**
 * Helpers that change an array in place.
 *
 * @see {@link https://arclockproject.org/docs/common/library/Array Guide} | {@link https://arclockproject.org/docs/api/common/library/Array API}
 */
const ArrayUtil = {
  /**
   * Shuffles `array` in place using the Fisher–Yates algorithm and `Math.random()`.
   *
   * @param array Array to shuffle. It is changed.
   * @returns The same array, for chaining.
   * @example
   * const cards = [1, 2, 3, 4];
   * ArrayUtil.shuffle(cards); // e.g. [3, 1, 4, 2], and `cards` is now in that order too
   */
  shuffle: <k>(array: k[]): k[] => {
    let currentIndex = array.length;
    // While there remain elements to shuffle...
    while (currentIndex !== 0) {
      // Pick a remaining element...
      const randomIndex = Math.floor(Math.random() * currentIndex);
      currentIndex--;
      // And swap it with the current element.
      ArrayUtil.swap(array, currentIndex, randomIndex);
    }
    return array;
  },
  /**
   * Swaps two elements of `array` in place.
   *
   * @param array Array to change.
   * @param currentIndex Index of the first element.
   * @param randomIndex Index of the second element.
   * @returns The same array, for chaining.
   * @example
   * ArrayUtil.swap(["a", "b", "c"], 0, 2); // ["c", "b", "a"]
   */
  swap: <k>(array: k[], currentIndex: number, randomIndex: number): k[] => {
    [array[currentIndex], array[randomIndex]] = [
      array[randomIndex]!,
      array[currentIndex]!,
    ];
    return array;
  },
  /**
   * Removes the first element that is `===` to `element`, in place.
   *
   * @param array Array to change.
   * @param element Element to find and remove.
   * @returns `true` if an element was removed, `false` if it was not found.
   * @example
   * const ids = [1, 2, 3, 2];
   * ArrayUtil.remove(ids, 2); // true, ids is now [1, 3, 2]
   */
  remove: <k>(array: k[], element: k): boolean => {
    const index = array.indexOf(element);
    if (index === -1) return false;
    array.splice(index, 1);
    return true;
  },
};

export default ArrayUtil;
