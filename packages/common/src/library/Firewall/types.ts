/**
 * A user's ID, as kept by {@link FirewallSession}.
 */
type UserID = string | number;

/**
 * Permission names mapped to their IDs. The names are used in code, the IDs are what gets stored.
 * A permission named `"*"` is the wildcard: a user who has it passes every rule.
 *
 * @deprecated Will not be exported in the next major version. The type stays the same.
 */
type FirewallPermissions = { readonly [name: string]: number };

declare const permissionBrand: unique symbol;

/**
 * A permission ID taken from `firewall.permissions`. A plain number is not accepted, so every
 * rule goes through a permission name, and renaming the name renames every use.
 *
 * @deprecated Will not be exported in the next major version. The type stays the same.
 */
type PermissionID = number & { readonly [permissionBrand]: true };

/**
 * The permission map as {@link PermissionID}s, with the same names.
 *
 * @deprecated Will not be exported in the next major version. The type stays the same.
 */
type PermissionIDs<Permissions extends FirewallPermissions> = {
  readonly [Name in keyof Permissions]: PermissionID;
};

/**
 * A permission check, built from {@link PermissionID}s.
 *
 * - `p.name` passes if the user has that permission.
 * - `[a, b]` passes if every rule in it passes. An empty array always passes.
 * - `{ any: [a, b] }` passes if at least one rule in it passes. An empty list never passes.
 * - `{ not: a }` passes if `a` does not.
 *
 * Rules can be nested, e.g. `{ any: [[p["posts.edit"], p["posts.delete"]], p["site.owner"]] }`.
 */
type PermissionRule =
  | PermissionID
  | readonly PermissionRule[]
  | { readonly any: readonly PermissionRule[] }
  | { readonly not: PermissionRule };

/**
 * The parts of a request the firewall reads. An Express request fits this.
 */
type FirewallRequest = {
  /** Request headers. */
  headers: { [name: string]: string | string[] | undefined };
  /** The connection. `remoteAddress` is the client IP used by default. */
  socket: {
    /** The client IP as the server sees it. Behind a proxy, this is the proxy's IP. */
    remoteAddress?: string | undefined;
  };
  /** The full URL path, passed to `accessDenied` and `onFailedLogin`. */
  originalUrl: string;
};

/**
 * Where the logged-in user is kept between requests. The default uses `express-session`:
 * see {@link FirewallOptions.session}.
 */
type FirewallSession<Req, Res> = {
  /**
   * Gives the logged-in user. `null` and `undefined` both mean nobody is logged in.
   * Called on every request by the middleware and by `protect`.
   *
   * @param req The request.
   */
  get: (
    req: Req,
  ) => UserID | null | undefined | Promise<UserID | null | undefined>;
  /**
   * Keeps `userID` as the logged-in user. Called once after a successful login, before
   * `afterLogin`. To prevent session fixation, give the user a new session id here.
   *
   * @param req The request.
   * @param res The response.
   * @param userID The user that logged in.
   */
  set: (req: Req, res: Res, userID: UserID) => void | Promise<void>;
  /**
   * Logs the user out. Called by `firewall.logout`.
   *
   * @param req The request.
   * @param res The response.
   */
  clear: (req: Req, res: Res) => void | Promise<void>;
};

/**
 * Continues to the next handler. Passing an error skips to the error handler, like in Express.
 *
 * @param err Error to report.
 *
 * @deprecated Will not be exported in the next major version. The type stays the same.
 */
type FirewallNext = (err?: unknown) => void;

/**
 * A request handler with the same arguments as an Express middleware.
 *
 * @deprecated Will not be exported in the next major version. The type stays the same.
 */
type FirewallMiddleware<Req, Res> = (
  req: Req,
  res: Res,
  next: FirewallNext,
) => void | Promise<void>;

/**
 * What a user sent to log in. A field is `undefined` when it was not sent.
 */
type FirewallCredentials = {
  /** Username from a login form. */
  username?: string;
  /** Password from a login form. */
  password?: string;
  /** API key, for logging in without a form. */
  apiKey?: string;
};

/**
 * The outcome of a login attempt.
 */
type FirewallLoginResult =
  | {
      /** The credentials are valid. */
      status: "ok";
      /** The user to log in. */
      userID: UserID;
    }
  | {
      /** The user exists, but the password or API key is wrong. */
      status: "wrong-password";
    }
  | {
      /** No user matches the credentials. */
      status: "not-found";
    };

/**
 * Why the login page is shown.
 *
 * - `"required"`: no credentials were sent.
 * - `"wrong-password"`: the user exists, but the password or API key is wrong.
 * - `"not-found"`: no user matches the credentials.
 *
 * @deprecated Will not be exported in the next major version. The type stays the same.
 */
type FirewallLoginReason = "required" | "wrong-password" | "not-found";

/**
 * Settings for {@link Firewall}. All app-specific work, like looking up accounts and showing pages,
 * is done by these callbacks.
 */
type FirewallOptions<Req, Res> = {
  /**
   * Reads the login fields from the request. Return an empty object when nothing was sent.
   *
   * @param req The request.
   */
  getCredentials: (req: Req) => FirewallCredentials;
  /**
   * Checks credentials. Only called when at least one credential field is set.
   *
   * @param credentials What `getCredentials` returned.
   * @param req The request.
   */
  authenticate: (
    credentials: FirewallCredentials,
    req: Req,
  ) => FirewallLoginResult | Promise<FirewallLoginResult>;
  /**
   * Gives the permission IDs a user has. Called by every `protect` check, so cache it if it is slow.
   *
   * @param userID The logged-in user.
   * @param req The request.
   */
  getPermissions: (
    userID: UserID,
    req: Req,
  ) => readonly number[] | Promise<readonly number[]>;
  /**
   * Shows the login page and ends the request.
   *
   * @param req The request.
   * @param res The response.
   * @param info Why it is shown, how many attempts this IP has left, and the username to fill in
   * (only set for `"wrong-password"`).
   */
  loginPage: (
    req: Req,
    res: Res,
    info: {
      /** Why the login page is shown. */
      reason: FirewallLoginReason;
      /** Failed logins this IP can still make before it is blocked. */
      attemptsLeft: number;
      /** The username that was tried. Only set when `reason` is `"wrong-password"`. */
      username?: string;
    },
  ) => void;
  /**
   * Ends a request the firewall will not let through.
   *
   * @param req The request.
   * @param res The response.
   * @param reason `"no-ip"` if the client IP could not be found, `"too-many-attempts"` if this IP
   * has no login attempts left.
   */
  blocked: (req: Req, res: Res, reason: "no-ip" | "too-many-attempts") => void;
  /**
   * Handles a request that failed a `protect` check, including requests with nobody logged in.
   *
   * @param req The request.
   * @param res The response.
   * @param next Continues to the next handler, if you want to let it through anyway.
   * @param info The URL path and the rule that failed.
   */
  accessDenied: (
    req: Req,
    res: Res,
    next: FirewallNext,
    info: {
      /** The full URL path of the request. */
      path: string;
      /** The rule given to `protect`. */
      require: PermissionRule;
    },
  ) => void;
  /**
   * Runs after a successful login, once `session.set` has finished. Use it to record the login or to
   * redirect. It must call `next` or end the request.
   *
   * @default (userID, req, res, next) => next()
   * @param userID The user that logged in.
   * @param req The request.
   * @param res The response.
   * @param next Continues to the requested page.
   */
  afterLogin?: (
    userID: UserID,
    req: Req,
    res: Res,
    next: FirewallNext,
  ) => void | Promise<void>;
  /**
   * Where the logged-in user is kept. Set it to use something other than `express-session`,
   * like a signed cookie or a token.
   *
   * The default uses `express-session` and `req.session.userID`. On login it starts a new
   * session (so an old session id can't be reused), sets `userID` and saves. On logout it starts
   * a new, empty session, which also removes anything else stored in the old one.
   *
   * @default express-session with `req.session.userID`
   */
  session?: FirewallSession<Req, Res>;
  /**
   * Runs on every failed login, before the login page is shown. Use it for logging.
   * Passwords and API keys are not passed.
   *
   * @param info The client IP, the username that was tried, the URL path, and why it failed.
   */
  onFailedLogin?: (info: {
    /** Client IP. */
    ip: string;
    /** The username that was tried, if any. */
    username?: string;
    /** The full URL path of the request. */
    path: string;
    /** Why the login failed. */
    reason: "wrong-password" | "not-found";
  }) => void;
  /**
   * Handles an error thrown by the firewall or your callbacks, in the login middleware and in
   * `protect`, instead of `next(err)`. Express's error handler is skipped unless you call
   * `next(err)` yourself. It must end the request or call `next`. An error thrown here goes to
   * `next(err)`, or is dropped with `hardened`.
   *
   * @default (err, req, res, next) => next(err)
   * @param err The error.
   * @param req The request.
   * @param res The response.
   * @param next Continues to the next handler. Does nothing with `hardened`.
   */
  onError?: (
    err: unknown,
    req: Req,
    res: Res,
    next: FirewallNext,
  ) => void | Promise<void>;
  /**
   * Never lets a request further after an error, not even to Express's error handler. Errors only
   * go to `onError`, which is then required and must end the request, since its `next` does
   * nothing. An error thrown in `onError` is dropped. Only logged-in requests and passed `protect`
   * checks reach `next`.
   *
   * @default false
   */
  hardened?: boolean;
  /**
   * Finds the client IP. Return `undefined` if it is unknown, and the request is passed to `blocked`.
   *
   * The default uses the connection's IP. Behind a proxy, that is the proxy's IP, so every client
   * shares one count. Then read the IP the proxy sets instead, e.g. Express's `req.ip` with
   * `trust proxy` on. Don't read `x-forwarded-for` unless a proxy overwrites it: clients can set
   * it themselves and get unlimited attempts.
   *
   * @default (req) => req.socket.remoteAddress
   * @param req The request.
   */
  getIP?: (req: Req) => string | undefined;
  /**
   * Failed logins allowed per IP. An attempt counts as soon as it starts, so logins sent at the
   * same time can't get past the limit. A successful login resets the count for that IP.
   * The counts are kept in memory, so they reset when the server restarts.
   *
   * @default 3
   */
  maxAttempts?: number;
  /**
   * Milliseconds after an IP's first failed login before its count resets. A blocked IP can try
   * again after this.
   *
   * @default 3600000 (1 hour)
   */
  attemptsResetAfter?: number;
};

/**
 * The first argument of `protect`.
 *
 * @deprecated Will not be exported in the next major version. The type stays the same.
 */
type FirewallProtectConfig<IDs> = {
  /**
   * The rule the logged-in user must pass. Either a {@link PermissionRule}, or a function that
   * gets `firewall.permissions` and returns one. The function runs once, when `protect` is called.
   */
  require: PermissionRule | ((permissions: IDs) => PermissionRule);
};

/**
 * Checks the logged-in user against a rule. If it passes, `next` is called. If not, the request
 * goes to `accessDenied`. Requests with nobody logged in always go to `accessDenied`. A user with
 * the `"*"` permission always passes.
 *
 * `Req` and `Res` are taken from where it is used, e.g. from `app.get()` in Express.
 *
 * @deprecated Will not be exported in the next major version. The type stays the same.
 */
type FirewallProtect<IDs, Req, Res> = {
  /**
   * Makes a middleware for one rule, to place in a route.
   *
   * @param conf The rule to check.
   * @returns A `(req, res, next)` middleware.
   */
  <R extends Req, S extends Res>(
    conf: FirewallProtectConfig<IDs>,
  ): FirewallMiddleware<R, S>;
  /**
   * Checks the rule for this request now, inside your own handler.
   *
   * @param conf The rule to check.
   * @param req The request.
   * @param res The response.
   * @param next Called if the check passes.
   */
  <R extends Req, S extends Res>(
    conf: FirewallProtectConfig<IDs>,
    req: R,
    res: S,
    next: FirewallNext,
  ): Promise<void>;
};

export type {
  FirewallCredentials,
  FirewallLoginReason,
  FirewallLoginResult,
  FirewallMiddleware,
  FirewallNext,
  FirewallOptions,
  FirewallPermissions,
  FirewallProtect,
  FirewallProtectConfig,
  FirewallRequest,
  FirewallSession,
  PermissionID,
  PermissionIDs,
  PermissionRule,
  UserID,
};
