function padZero(number: number): string {
  return `${number < 10 ? "0" : ""}${number}`;
}
const Time = {
  /**
   * Example
   * @param time 134
   * @returns "2:14"
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
