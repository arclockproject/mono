import type {
  FirewallMiddleware,
  FirewallNext,
  FirewallOptions,
  FirewallRequest,
  FirewallSession,
} from "./types";

/**
 * Reads the client IP from the connection.
 *
 * @param req The request.
 * @returns The IP, or `undefined` if it is unknown.
 */
function defaultGetIP(req: FirewallRequest): string | undefined {
  return req.socket.remoteAddress;
}

/**
 * Creates the login middleware. Logged-in requests pass through. Other requests are logged in
 * with their credentials, or get the login page.
 *
 * @param options The firewall's options.
 * @param session Where the logged-in user is kept.
 * @returns The middleware.
 */
function createFirewallMiddleware<Req extends FirewallRequest, Res>(
  options: FirewallOptions<Req, Res>,
  session: FirewallSession<Req, Res>,
): FirewallMiddleware<Req, Res> {
  const maxAttempts = options.maxAttempts ?? 3;
  const resetAfter = options.attemptsResetAfter ?? 60 * 60 * 1000;
  const getIP = options.getIP ?? defaultGetIP;
  const attempts = new Map<string, { left: number; expires: number }>();
  const removeExpired = (now: number) => {
    for (const [ip, entry] of attempts) {
      if (entry.expires > now) break;
      attempts.delete(ip);
    }
  };
  return async (req, res, next) => {
    try {
      const current = await session.get(req);
      if (current !== undefined && current !== null) {
        next();
        return;
      }
      const ip = getIP(req);
      if (ip === undefined) {
        options.blocked(req, res, "no-ip");
        return;
      }
      removeExpired(Date.now());
      const left = attempts.get(ip)?.left ?? maxAttempts;
      if (left <= 0) {
        options.blocked(req, res, "too-many-attempts");
        return;
      }
      const credentials = options.getCredentials(req);
      if (
        credentials.username === undefined &&
        credentials.password === undefined &&
        credentials.apiKey === undefined
      ) {
        options.loginPage(req, res, { reason: "required", attemptsLeft: left });
        return;
      }
      const entry = attempts.get(ip) ?? {
        left: maxAttempts,
        expires: Date.now() + resetAfter,
      };
      entry.left -= 1;
      const leftAfter = entry.left;
      attempts.set(ip, entry);
      const result = await options.authenticate(credentials, req);
      if (result.status === "ok") {
        attempts.delete(ip);
        await session.set(req, res, result.userID);
        if (options.afterLogin) {
          await options.afterLogin(result.userID, req, res, next);
        } else {
          next();
        }
        return;
      }
      options.onFailedLogin?.({
        ip,
        username: credentials.username,
        path: req.originalUrl,
        reason: result.status,
      });
      options.loginPage(req, res, {
        reason: result.status,
        attemptsLeft: leftAfter,
        username:
          result.status === "wrong-password" ? credentials.username : undefined,
      });
    } catch (err) {
      await handleError(options, err, req, res, next);
    }
  };
}

/**
 * Passes an error to `onError`, or to `next(err)` without it. With `hardened`, `next` is never
 * called and an error thrown in `onError` is dropped.
 *
 * @param options The firewall's options.
 * @param err The error.
 * @param req The request.
 * @param res The response.
 * @param next The request's `next`.
 */
async function handleError<Req, Res>(
  options: FirewallOptions<Req, Res>,
  err: unknown,
  req: Req,
  res: Res,
  next: FirewallNext,
): Promise<void> {
  if (!options.onError) {
    if (!options.hardened) next(err);
    return;
  }
  try {
    await options.onError(err, req, res, options.hardened ? () => {} : next);
  } catch (error) {
    if (!options.hardened) next(error);
  }
}

export { createFirewallMiddleware, handleError };
