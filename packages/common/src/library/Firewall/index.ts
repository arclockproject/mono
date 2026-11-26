import { createFirewallMiddleware } from "./firewall";
import { createProtect, isAllowed, WILDCARD } from "./protect";
import { expressSession } from "./session";
import type {
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
} from "./types";

/**
 * What {@link Firewall} returns.
 */
type FirewallInstance<
  Permissions extends FirewallPermissions,
  Req extends FirewallRequest,
  Res,
> = {
  /**
   * The permission map passed to `Firewall`, as {@link PermissionID}s. Build rules from these,
   * e.g. `firewall.permissions["posts.edit"]`, so renaming a permission renames every use.
   */
  permissions: PermissionIDs<Permissions>;
  /**
   * Middleware that lets logged-in requests through. Other requests are logged in with the
   * credentials they sent, or get the login page. Add it before the routes it should guard.
   */
  middleware: FirewallMiddleware<Req, Res>;
  /**
   * Checks the logged-in user against a rule. See {@link FirewallProtect}.
   */
  protect: FirewallProtect<PermissionIDs<Permissions>, Req, Res>;
  /**
   * Checks a rule against permission IDs, without a request. Useful when you already have the
   * user's permissions, e.g. to hide a button. The `"*"` permission passes every rule here too.
   *
   * @param rule The rule to check.
   * @param granted The user's permission IDs.
   * @returns `true` if the rule passes.
   */
  check: (rule: PermissionRule, granted: readonly number[]) => boolean;
  /**
   * Gives the logged-in user of a request, from {@link FirewallOptions.session}.
   *
   * @param req The request.
   * @returns The user, or `undefined` if nobody is logged in.
   */
  userID: (req: Req) => Promise<UserID | undefined>;
  /**
   * Logs the request's user out, with {@link FirewallOptions.session}. With the default
   * `express-session` storage, the session is replaced by a new, empty one.
   *
   * @param req The request.
   * @param res The response.
   */
  logout: (req: Req, res: Res) => Promise<void>;
};

/**
 * Creates a login firewall and permission checks for an Express-style server.
 *
 * Permissions are named in code and stored by ID. Rules are built from `firewall.permissions`,
 * so renaming a name (e.g. with F2) renames every use. Changing an ID changes what is read from storage.
 *
 * Express and the account storage are not included. Account lookup, pages and redirects are
 * passed in as `options`. The logged-in user is kept with `express-session` unless
 * `options.session` says otherwise.
 *
 * @see {@link https://arclockproject.org/docs/common/library/Firewall Guide} | {@link https://arclockproject.org/docs/api/common/library/Firewall API}
 * @param permissions Permission names mapped to IDs. A permission named `"*"` is the wildcard:
 * a user who has it passes every rule, including `{ not: … }` rules, like an owner account.
 * @param options Callbacks and settings. See {@link FirewallOptions}.
 * @example
 * const firewall = Firewall({ "posts.edit": 10, "posts.delete": 11, "site.owner": 1 }, options);
 * app.use(firewall.middleware);
 * app.post("/posts/:id", firewall.protect({ require: (p) => ({ any: [[p["posts.edit"], p["posts.delete"]], p["site.owner"]] }) }), handler);
 * firewall.check({ not: firewall.permissions["site.owner"] }, [10]); // true
 */
function Firewall<
  const Permissions extends FirewallPermissions,
  Req extends FirewallRequest = FirewallRequest,
  Res = unknown,
>(
  permissions: Permissions,
  options: FirewallOptions<Req, Res>,
): FirewallInstance<Permissions, Req, Res> {
  if (options.hardened && !options.onError) {
    throw new Error(
      "Firewall: hardened needs onError to answer requests that fail.",
    );
  }
  const ids = permissions as unknown as PermissionIDs<Permissions>;
  const session =
    options.session ?? (expressSession as FirewallSession<Req, Res>);
  const wildcard = Object.hasOwn(permissions, WILDCARD)
    ? permissions[WILDCARD]
    : undefined;
  return {
    permissions: ids,
    middleware: createFirewallMiddleware(options, session),
    protect: createProtect(ids, options, session, wildcard),
    check: (rule, granted) => isAllowed(rule, new Set(granted), wildcard),
    userID: async (req) => (await session.get(req)) ?? undefined,
    logout: async (req, res) => {
      await session.clear(req, res);
    },
  };
}

export default Firewall;
export type {
  FirewallCredentials,
  FirewallInstance,
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
