import ArrayUtil from "@arclockproject/common/library/Array";

// biome-ignore lint/suspicious/noExplicitAny: Works and does not have effect outside of this file anyways
type EventMapBlank = { [key: string]: (...any: any) => void };
/**
 * EventManager creates an object that allows for listeners to be stored on it.
 *
 * Additionally events can be dispatched to the stored listeners.
 *
 * @example
 * const events = new EventManager<{
 *   pay: (client: string, details: { amount: number }) => void;
 * }>();
 *
 * const event = (client, details) => { ... }
 *
 * events.addListener('pay', event)
 * events.removeListener('pay', event)
 * events.dispatch('pay', 'Alex', { amount: 100})
 */
class EventManager<EventMap extends EventMapBlank> {
  private events: { [key in keyof EventMap]?: EventMap[key][] } = {};
  constructor(defaults?: { [key in keyof EventMap]: EventMap[key][] }) {
    this.events = defaults ?? ({} as NonNullable<typeof defaults>);
  }
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
  removeListener<k extends keyof EventMap>(
    type: k,
    listener: EventMap[k],
  ): void {
    if (this.events[type]) ArrayUtil.remove(this.events[type]!, listener);
  }
  removeAllListeners<k extends keyof EventMap>(type: k): void {
    delete this.events[type];
  }
  removeAll(): void {
    this.events = {};
  }
  /**
   *
   * @param type Name of event to dispatch
   * @param payload Dynamic parameters of the listeners
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
