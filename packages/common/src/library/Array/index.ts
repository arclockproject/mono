const ArrayUtil = {
  /**
   * Modifies the passed array
   * @param array
   * @returns the passed array
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
   * Modifies the passed array
   * @param array
   * @param currentIndex
   * @param randomIndex
   * @returns the passed array
   */
  swap: <k>(array: k[], currentIndex: number, randomIndex: number): k[] => {
    [array[currentIndex], array[randomIndex]] = [
      array[randomIndex]!,
      array[currentIndex]!,
    ];
    return array;
  },
  /**
   * @param array Array that will be modified
   * @param element Element to find and remove.
   * @returns Return `true` if element was removed, else `false`.
   */
  remove: <k>(array: k[], element: k): boolean => {
    const index = array.indexOf(element);
    if (index === -1) return false;
    array.splice(index, 1);
    return true;
  },
};

export default ArrayUtil;
