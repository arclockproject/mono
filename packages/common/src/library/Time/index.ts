function padZero(number: number): string {
  return `${number < 10 ? "0" : ""}${number}`;
}
/**
 * Helpers for showing durations and elapsed time as text.
 *
 * @see {@link https://arclockproject.org/docs/common/library/Time Guide} | {@link https://arclockproject.org/docs/api/common/library/Time API}
 */
const Time = {
  /**
   * Formats seconds as a timestamp, like a video player shows: `1:00:05`, `2:00` or `0:06`.
   *
   * Hours are left out when they are 0, and the first unit is not zero-padded.
   * `356000` means "unknown duration" and gives `"--:--"`.
   *
   * @param time Seconds. A string is read with `parseInt()`, so decimals are dropped.
   * @returns `H:MM:SS` or `M:SS`. `"--:--"` for `356000`, and `null` if `time` is not a number.
   * @example
   * Time.parseTimeDuration(3605);   // "1:00:05"
   * Time.parseTimeDuration(120);    // "2:00"
   * Time.parseTimeDuration(6);      // "0:06"
   * Time.parseTimeDuration("foo");  // null
   * Time.parseTimeDuration(356000); // "--:--"
   */
  parseTimeDuration: (time: number | string): string | null => {
    const number = parseInt(time as string, 10);
    if (number === 356000) return "--:--";
    if (Number.isNaN(number)) return null;
    const h = Math.floor(number / 3600);
    const m = Math.floor((number % 3600) / 60);
    const s = number % 60;
    if (m + h === 0) return `0:${padZero(s)}`;
    if (h === 0) return `${m}:${padZero(s)}`;
    return `${h}:${padZero(m)}:${padZero(s)}`;
  },
  /**
   * Says how long ago `date` was, in the largest whole unit, e.g. `"2 days"`.
   * Add your own "ago" when showing it.
   *
   * A unit is only used once more than 1 of it has passed, so exactly one hour
   * gives `"60 minutes"`. Units are always plural, e.g. `"1 hours"`. A month
   * counts as 30 days and a year as 365 days.
   *
   * @param date Unix timestamp in seconds, not milliseconds. A string is read with `parseInt()`.
   * @returns `"{number} {unit}"`, where unit is `minutes`, `hours`, `days`, `months` or `years`.
   * @example
   * const now = Math.floor(Date.now() / 1000);
   *
   * Time.timeSince(now - 130);    // "2 minutes"
   * Time.timeSince(now - 3600);   // "60 minutes"
   * Time.timeSince(now - 3601);   // "1 hours"
   * Time.timeSince(now - 172800); // "2 days"
   */
  timeSince: (date: number | string): string => {
    var seconds = Math.floor(Date.now() / 1000 - parseInt(date as string, 10));
    var interval = seconds / 31536000;
    if (interval > 1) return `${Math.floor(interval)} years`;
    interval = seconds / 2592000;
    if (interval > 1) return `${Math.floor(interval)} months`;
    interval = seconds / 86400;
    if (interval > 1) return `${Math.floor(interval)} days`;
    interval = seconds / 3600;
    if (interval > 1) return `${Math.floor(interval)} hours`;
    interval = seconds / 60;
    if (interval > 1) return `${Math.floor(interval)} minutes`;
    return `${Math.floor(interval)} seconds`;
  },
};
export default Time;
