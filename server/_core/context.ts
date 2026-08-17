import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import type { User } from "../../drizzle/schema";
import { authenticateRequest } from "./sdk";

export type TrpcContext = {
  req: CreateExpressContextOptions["req"];
  res: CreateExpressContextOptions["res"];
  user: User | null;
  // The tenant the client is actively operating in, sent via the x-tenant-id
  // header by the admin tenant switcher. Only honored for platform admins
  // (see resolveActiveTenant in trpc.ts); non-admins are pinned to their own tenant.
  requestedTenantId?: number;
};

export async function createContext(
  opts: CreateExpressContextOptions
): Promise<TrpcContext> {
  const user = await authenticateRequest(opts.req);
  const rawHeader = opts.req.headers["x-tenant-id"];
  const rawTenant = Array.isArray(rawHeader) ? rawHeader[0] : rawHeader;
  const requestedTenantId = rawTenant && /^\d+$/.test(rawTenant) ? Number(rawTenant) : undefined;
  return { req: opts.req, res: opts.res, user, requestedTenantId };
}
