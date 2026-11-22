import type { FirewallSession, UserID } from "./types";

/**
 * The parts of an `express-session` session the default storage uses.
 */
type ExpressSession = {
  /** The logged-in user. */
  userID?: UserID | null;
  /**
   * Replaces the session with a new, empty one with a new id.
   *
   * @param callback Called when done, with an error if it failed.
   */
  regenerate(callback: (err?: unknown) => void): unknown;
  /**
   * Saves the session.
   *
   * @param callback Called when done, with an error if it failed.
   */
  save(callback: (err?: unknown) => void): unknown;
};

/**
 * Gives the request's session.
 *
 * @param req The request.
 * @returns The session.
 * @throws {Error} If there is no `express-session` session on the request.
 */
function sessionOf(req: unknown): ExpressSession {
  const session = (req as { session?: Partial<ExpressSession> }).session;
  if (
    !session ||
    typeof session.regenerate !== "function" ||
    typeof session.save !== "function"
  ) {
    throw new Error(
      "Firewall needs express-session (app.use(session(...)) before the firewall), or a `session` option.",
    );
  }
  return session as ExpressSession;
}

/**
 * Runs a session method that takes a callback.
 *
 * @param run Calls the method with the callback.
 * @returns A promise that settles when the callback is called.
 */
function call(
  run: (callback: (err?: unknown) => void) => unknown,
): Promise<void> {
  return new Promise((resolve, reject) => {
    run((err) => (err ? reject(err) : resolve()));
  });
}

/**
 * Keeps the logged-in user in `req.session.userID` with `express-session`. Login and logout both
 * start a new session, so a session id from before the login can't be reused.
 */
const expressSession: FirewallSession<unknown, unknown> = {
  get: (req) =>
    (req as { session?: { userID?: UserID | null } }).session?.userID,
  set: async (req, _res, userID) => {
    await call((done) => sessionOf(req).regenerate(done));
    const session = sessionOf(req);
    session.userID = userID;
    await call((done) => session.save(done));
  },
  clear: async (req) => {
    await call((done) => sessionOf(req).regenerate(done));
  },
};

export { expressSession };
