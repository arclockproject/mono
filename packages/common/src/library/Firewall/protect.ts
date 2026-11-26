import { handleError } from "./firewall";
import type {
  FirewallNext,
  FirewallOptions,
  FirewallProtect,
  FirewallProtectConfig,
  FirewallRequest,
  FirewallSession,
  PermissionRule,
} from "./types";

/**
 * Checks a rule against the permission IDs a user has.
 *
 * @param rule The rule to check.
 * @param granted The user's permission IDs.
 * @returns `true` if the rule passes.
 */
function checkRule(
  rule: PermissionRule,
  granted: ReadonlySet<number>,
): boolean {
  if (typeof rule === "number") return granted.has(rule);
  if ("not" in rule) return !checkRule(rule.not, granted);
  if ("any" in rule) return rule.any.some((r) => checkRule(r, granted));
  return rule.every((r) => checkRule(r, granted));
}

/**
 * The name of the wildcard permission. A user who has it passes every rule.
 */
const WILDCARD = "*";

/**
 * Checks a rule against the permission IDs a user has. A user with the wildcard permission passes
 * every rule, including `{ not: … }` rules.
 *
 * @param rule The rule to check.
 * @param granted The user's permission IDs.
 * @param wildcard The ID of the `"*"` permission, if the permission map has one.
 * @returns `true` if the user is allowed.
 */
function isAllowed(
  rule: PermissionRule,
  granted: ReadonlySet<number>,
  wildcard: number | undefined,
): boolean {
  if (wildcard !== undefined && granted.has(wildcard)) return true;
  return checkRule(rule, granted);
}

/**
 * Creates the `protect` function of a firewall.
 *
 * @param ids The permission map as IDs, passed to `require` when it is a function.
 * @param options The firewall's options.
 * @param session Where the logged-in user is kept.
 * @param wildcard The ID of the `"*"` permission, if the permission map has one.
 * @returns `protect`.
 */
function createProtect<IDs, Req extends FirewallRequest, Res>(
  ids: IDs,
  options: FirewallOptions<Req, Res>,
  session: FirewallSession<Req, Res>,
  wildcard: number | undefined,
): FirewallProtect<IDs, Req, Res> {
  const run = async (
    rule: PermissionRule,
    req: Req,
    res: Res,
    next: FirewallNext,
  ): Promise<void> => {
    try {
      const userID = await session.get(req);
      const granted =
        userID === undefined || userID === null
          ? []
          : await options.getPermissions(userID, req);
      if (isAllowed(rule, new Set(granted), wildcard)) {
        next();
        return;
      }
      options.accessDenied(req, res, next, {
        path: req.originalUrl,
        require: rule,
      });
    } catch (err) {
      await handleError(options, err, req, res, next);
    }
  };
  function protect(
    conf: FirewallProtectConfig<IDs>,
    req?: Req,
    res?: Res,
    next?: FirewallNext,
  ) {
    const rule =
      typeof conf.require === "function" ? conf.require(ids) : conf.require;
    if (req === undefined) {
      return (rq: Req, rs: Res, nx: FirewallNext) => run(rule, rq, rs, nx);
    }
    return run(rule, req, res as Res, next as FirewallNext);
  }
  return protect as FirewallProtect<IDs, Req, Res>;
}

export { createProtect, isAllowed, WILDCARD };
