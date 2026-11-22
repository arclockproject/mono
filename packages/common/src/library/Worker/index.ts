import ArrayUtil from "@arclockproject/common/library/Array";

/**
 * The function a {@link Worker} runs for each payload.
 *
 * @param payload The queued item to process.
 * @param updatePercentage Reports progress from `0` to `1`. Values outside that range are clamped.
 * Calls after the task was dropped are ignored.
 * @param signal Aborted when the task is dropped with `force`. Pass it to `fetch` or check
 * `signal.aborted` to stop early.
 * @returns `true` if the payload was processed, `false` if it failed. A thrown error counts as `false`.
 * After `signal` is aborted, `true` means the action stopped the way it wanted to, and `false` means it could not.
 */
type WorkerAction<Payload> = (
  payload: Payload,
  updatePercentage: (percentage: number) => void,
  signal: AbortSignal,
) => Promise<boolean>;

/**
 * A payload that is being processed.
 */
type WorkerTask<Payload> = {
  /** The payload passed to the action. */
  payload: Payload;
  /** Last progress reported by the action, from `0` to `1`. */
  percentage: number;
  /** Aborts the action's `signal` when the task is dropped with `force`. */
  controller: AbortController;
};

/**
 * A snapshot of the worker's queue and progress.
 */
type WorkerStatus = {
  /** Payloads waiting to start. */
  queued: number;
  /** Payloads being processed right now. At most `count`. */
  running: number;
  /** `queued + running`. */
  tasks: number;
  /**
   * Average progress of the running payloads, from `0` to `1`. `0` when nothing is running.
   * With `count` set to `1`, this is the progress of the current payload.
   */
  percentage: number;
  /** Payloads whose action returned `true`. */
  completed: number;
  /**
   * Payloads whose action returned `false` or threw, including running payloads stopped with `force`.
   * A stopped payload whose action returns `true` stopped cleanly, so it is not counted here or in `completed`.
   * Queued payloads that were dropped are not counted.
   */
  failed: number;
};

/**
 * Processes queued payloads with an async action, running up to `count` at the same time.
 *
 * Nothing runs until `start()` is called. After that, the worker checks for free slots every
 * `workerTickRate` ms and starts the next payloads in the order they were queued.
 * Payloads queued later are picked up on the next check.
 *
 * @see {@link https://arclockproject.org/docs/common/library/Worker Guide} | {@link https://arclockproject.org/docs/api/common/library/Worker API}
 * @example
 * const worker = new Worker<string>(async (url, update, signal) => (await fetch(url, { signal })).ok, 2);
 * worker.queue("/a.png");
 * worker.start();
 * worker.status(); // { queued: 0, running: 1, tasks: 1, percentage: 0, completed: 0, failed: 0 }
 */
class Worker<Payload> {
  /**
   * Payloads waiting to start, next one first. Changing this array changes the queue.
   */
  work: Payload[] = [];
  private running: WorkerTask<Payload>[] = [];
  private timer: ReturnType<typeof setInterval> | null = null;
  private completed = 0;
  private failed = 0;
  /**
   * Creates a stopped worker with an empty queue.
   *
   * @param currentAction Runs once per payload. See {@link WorkerAction}.
   * @param count How many payloads can run at the same time. Read on every check, so it can be changed later.
   * @param workerTickRate Milliseconds between checks for free slots. Read when `start()` is called.
   */
  constructor(
    public currentAction: WorkerAction<Payload>,
    public count: number = 1,
    public workerTickRate: number = 1000,
  ) {}
  /**
   * Adds a payload to the end of the queue.
   *
   * @param payload The item to process.
   */
  queue = (payload: Payload): void => {
    this.work.push(payload);
  };
  /**
   * Drops one payload.
   *
   * @param force `false` removes the next queued payload. `true` stops the oldest running payload instead:
   * its `signal` is aborted and its slot is freed at once. When its action settles, it counts as
   * `failed` if it returned `false` or threw. If it returned `true`, it is not counted.
   * @returns `true` if a payload was dropped, `false` if there was nothing to drop.
   */
  drop = (force = false): boolean => {
    if (!force) {
      if (this.work.length === 0) return false;
      this.work.shift();
      return true;
    }
    const task = this.running[0];
    if (!task) return false;
    this.abort(task);
    return true;
  };
  /**
   * Clears the queue. Running payloads are left to finish unless `force` is set.
   *
   * @param force Also stop every running payload, like `drop(true)` does for one.
   * @returns `true` if any payload was dropped.
   */
  dropAll = (force = false): boolean => {
    const dropped = this.work.length > 0 || (force && this.running.length > 0);
    this.work.length = 0;
    if (force) for (const task of [...this.running]) this.abort(task);
    return dropped;
  };
  /**
   * Gives the queue size and progress at this moment.
   *
   * @returns A new {@link WorkerStatus} object on each call.
   */
  status = (): WorkerStatus => ({
    queued: this.work.length,
    running: this.running.length,
    tasks: this.work.length + this.running.length,
    percentage:
      this.running.length === 0
        ? 0
        : this.running.reduce((sum, task) => sum + task.percentage, 0) /
          this.running.length,
    completed: this.completed,
    failed: this.failed,
  });
  /**
   * Starts processing. The first check runs at once, then every `workerTickRate` ms.
   * Does nothing if the worker is already started.
   */
  start = (): void => {
    if (this.timer !== null) return;
    this.tick();
    this.timer = setInterval(this.tick, this.workerTickRate);
  };
  /**
   * Stops starting new payloads. Running payloads are left to finish and the queue is kept,
   * so `start()` continues where it stopped.
   */
  stop = (): void => {
    if (this.timer === null) return;
    clearInterval(this.timer);
    this.timer = null;
  };
  /**
   * `true` between `start()` and `stop()`.
   */
  get started(): boolean {
    return this.timer !== null;
  }
  private tick = () => {
    while (this.running.length < this.count && this.work.length > 0) {
      this.run(this.work.shift() as Payload);
    }
  };
  private run(payload: Payload) {
    const task: WorkerTask<Payload> = {
      payload,
      percentage: 0,
      controller: new AbortController(),
    };
    const { signal } = task.controller;
    this.running.push(task);
    const updatePercentage = (percentage: number) => {
      if (!signal.aborted)
        task.percentage = Math.min(1, Math.max(0, percentage));
    };
    let result: Promise<boolean>;
    try {
      result = this.currentAction(payload, updatePercentage, signal);
    } catch {
      result = Promise.resolve(false);
    }
    result
      .catch(() => false)
      .then((ok) => {
        if (signal.aborted) {
          if (!ok) this.failed++;
          return;
        }
        ArrayUtil.remove(this.running, task);
        if (ok) this.completed++;
        else this.failed++;
      });
  }
  private abort(task: WorkerTask<Payload>) {
    task.controller.abort();
    ArrayUtil.remove(this.running, task);
  }
}

export default Worker;
export type { WorkerAction, WorkerStatus };
