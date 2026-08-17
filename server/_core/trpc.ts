import { NOT_ADMIN_ERR_MSG, UNAUTHED_ERR_MSG } from '@shared/const';
import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import type { TrpcContext } from "./context";

const t = initTRPC.context<TrpcContext>().create({
  transformer: superjson,
});

export const router = t.router;
export const publicProcedure = t.procedure;

const requireUser = t.middleware(async opts => {
  const { ctx, next } = opts;

  if (!ctx.user) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
  }

  return next({
    ctx: {
      ...ctx,
      user: ctx.user,
    },
  });
});

export const protectedProcedure = t.procedure.use(requireUser);

// Resolve which tenant this request operates in. Platform admins may act within
// another tenant via the switcher (x-tenant-id header → ctx.requestedTenantId);
// everyone else is pinned to their own tenant, so the header can never be used
// to reach into a tenant the user doesn't belong to.
export function resolveActiveTenant(user: NonNullable<TrpcContext["user"]>, requestedTenantId?: number): number | undefined {
  if (user.role === "admin" && requestedTenantId) return requestedTenantId;
  return user.tenantId ?? undefined;
}

const requireTenant = t.middleware(async opts => {
  const { ctx, next } = opts;

  if (!ctx.user) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
  }

  const tenantId = resolveActiveTenant(ctx.user, ctx.requestedTenantId);
  if (!tenantId) {
    throw new TRPCError({ code: "FORBIDDEN", message: "No tenant associated with your account. Create or join a tenant first." });
  }

  return next({
    ctx: {
      ...ctx,
      user: ctx.user,
      tenantId,
    },
  });
});

export const tenantProcedure = t.procedure.use(requireTenant);

export const adminProcedure = t.procedure.use(
  t.middleware(async opts => {
    const { ctx, next } = opts;

    if (!ctx.user || ctx.user.role !== 'admin') {
      throw new TRPCError({ code: "FORBIDDEN", message: NOT_ADMIN_ERR_MSG });
    }

    return next({
      ctx: {
        ...ctx,
        user: ctx.user,
      },
    });
  }),
);

// Tenant admin or platform admin — can manage members, invites, tenant settings.
// Platform admins may not have a personal tenantId; they pass the target tenantId via endpoint input.
const requireTenantAdmin = t.middleware(async opts => {
  const { ctx, next } = opts;
  if (!ctx.user) throw new TRPCError({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
  const isAdmin = ctx.user.role === "admin";
  const isTenantAdmin = ctx.user.tenantRole === "owner" || ctx.user.tenantRole === "admin";
  if (!isAdmin && !isTenantAdmin) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Tenant admin access required." });
  }
  const tenantId = resolveActiveTenant(ctx.user, ctx.requestedTenantId);
  if (!tenantId) {
    throw new TRPCError({ code: "FORBIDDEN", message: "No tenant associated with your account." });
  }
  return next({ ctx: { ...ctx, user: ctx.user, tenantId } });
});

export const tenantAdminProcedure = t.procedure.use(requireTenantAdmin);

// Any tenant member who can write (owner/admin/developer) — blocks viewers
const requireTenantWrite = t.middleware(async opts => {
  const { ctx, next } = opts;
  if (!ctx.user) throw new TRPCError({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
  const isAdmin = ctx.user.role === "admin";
  const tenantId = resolveActiveTenant(ctx.user, ctx.requestedTenantId);
  if (!tenantId) throw new TRPCError({ code: "FORBIDDEN", message: "No tenant associated with your account." });
  const canWrite = ctx.user.tenantRole === "owner" || ctx.user.tenantRole === "admin" || ctx.user.tenantRole === "developer";
  if (!isAdmin && !canWrite) {
    throw new TRPCError({ code: "FORBIDDEN", message: "You have view-only access. Contact your tenant admin to change your role." });
  }
  return next({ ctx: { ...ctx, user: ctx.user, tenantId } });
});

export const tenantWriteProcedure = t.procedure.use(requireTenantWrite);
