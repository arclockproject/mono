import ArrayUtil from "@arclockproject/common/library/Array";

/**
 * The shape every event map must have: event names mapped to listener functions.
 */
// biome-ignore lint/suspicious/noExplicitAny: Works and does not have effect outside of this file anyways
type EventMapBlank = { [key: string]: (...any: any) => void };
/**
 * A typed event emitter. `EventMap` maps each event name to its listener's
 * signature, so `dispatch` and `addListener` are type-checked.
 *
 * @see {@link https://arclockproject.org/docs/common/library/EventManager Guide} | {@link https://arclockproject.org/docs/api/common/library/EventManager API}
 * @example
 * const events = new EventManager<{
 *   pay: (client: string, amount: number) => void;
 * }>();
 *
 * events.addListener("pay", (client, amount) => console.log(client, amount));
 * events.dispatch("pay", "Alex", 100); // logs "Alex 100"
 */
class EventManager<EventMap extends EventMapBlank> {
  private events: { [key in keyof EventMap]?: EventMap[key][] } = {};
  /**
   * Creates an event manager with no listeners, or with `defaults`.
   *
   * @param defaults Listeners to start with, per event. The arrays are used as they are, not
   * copied, so adding or removing listeners to said array also changes them in EventManager.
   */
  constructor(defaults?: { [key in keyof EventMap]: EventMap[key][] }) {
    this.events = defaults ?? ({} as NonNullable<typeof defaults>);
  }
  /**
   * Adds a listener for `type`. Adding the same listener twice makes it run twice.
   *
   * @param type Event name.
   * @param listener Function to call when the event is dispatched.
   * @returns `listener`, so an inline function can be kept for `removeListener`.
   */
  addListener<k extends keyof EventMap>(
    type: k,
    listener: EventMap[k],
  ): EventMap[k] {
    if (this.events[type]) {
      this.events[type]!.push(listener);
    } else {
      this.events[type] = [listener];
    }
    return listener;
  }
  /**
   * Removes one registration of `listener` for `type`. Does nothing if it was not added.
   *
   * @param type Event name.
   * @param listener The same function that was passed to `addListener`.
   */
  removeListener<k extends keyof EventMap>(
    type: k,
    listener: EventMap[k],
  ): void {
    if (this.events[type]) ArrayUtil.remove(this.events[type]!, listener);
  }
  /**
   * Removes every listener for `type`.
   *
   * @param type Event name.
   */
  removeAllListeners<k extends keyof EventMap>(type: k): void {
    delete this.events[type];
  }
  /**
   * Removes every listener for every event.
   */
  removeAll(): void {
    this.events = {};
  }
  /**
   * Calls every listener for `type` right away, in the order they were added.
   *
   * @param type Event name.
   * @param payload Arguments passed to each listener.
   */
  dispatch<k extends keyof EventMap>(
    type: k,
    ...payload: Parameters<EventMap[k]>
  ): void {
    this.events[type]?.forEach((listener) => {
      listener(...payload);
    });
  }
}
export default EventManager;
export type { EventMapBlank };
