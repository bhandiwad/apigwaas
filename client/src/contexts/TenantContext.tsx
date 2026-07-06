import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";

const TENANT_KEY = "ci.tenantId";
const WORKSPACE_KEY = "ci.workspaceId";

type Tenant = { id: number; name: string };
type Workspace = { id: number; name: string; tenantId?: number };

interface TenantContextValue {
  /** Currently-selected tenant id (session tenant for non-admins). */
  tenantId: number | null;
  setTenantId: (id: number) => void;
  /** Selected workspace id, or null for "all workspaces". */
  workspaceId: number | null;
  setWorkspaceId: (id: number | null) => void;
  tenants: Tenant[];
  workspaces: Workspace[];
  isAdmin: boolean;
  /** Pass to tenant-scoped queries: the admin-selected tenant, or undefined so the server uses the session tenant. */
  effectiveTenantId: number | undefined;
}

const TenantContext = createContext<TenantContextValue | undefined>(undefined);

function readStored(key: string): number | null {
  const v = typeof window !== "undefined" ? window.localStorage.getItem(key) : null;
  return v ? Number(v) : null;
}

export function TenantProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const sessionTenantId = user?.tenantId ?? null;

  const [tenantId, setTenantIdState] = useState<number | null>(() => readStored(TENANT_KEY));
  const [workspaceId, setWorkspaceIdState] = useState<number | null>(() => readStored(WORKSPACE_KEY));

  // Default to the session tenant once the user has loaded.
  useEffect(() => {
    if (tenantId == null && sessionTenantId != null) setTenantIdState(sessionTenantId);
  }, [sessionTenantId, tenantId]);

  const tenantsQuery = trpc.tenant.list.useQuery(undefined, { enabled: !!user });
  const tenants = (tenantsQuery.data ?? []) as Tenant[];

  // A tenant id left in localStorage by a different user isn't valid for this
  // one — snap back to the session tenant once the tenant list has loaded.
  useEffect(() => {
    if (tenants.length > 0 && tenantId != null && !tenants.some(t => t.id === tenantId) && sessionTenantId != null) {
      setTenantIdState(sessionTenantId);
      window.localStorage.setItem(TENANT_KEY, String(sessionTenantId));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenants, sessionTenantId]);

  // Only admins may query a tenant other than their own; for everyone else the
  // server derives the tenant from the session (pass undefined).
  const effectiveTenantId = isAdmin ? tenantId ?? undefined : undefined;

  const workspacesQuery = trpc.workspace.list.useQuery(
    effectiveTenantId ? { tenantId: effectiveTenantId } : undefined,
    { enabled: !!user },
  );
  const workspaces = (workspacesQuery.data ?? []) as Workspace[];

  const setWorkspaceId = (id: number | null) => {
    setWorkspaceIdState(id);
    if (id == null) window.localStorage.removeItem(WORKSPACE_KEY);
    else window.localStorage.setItem(WORKSPACE_KEY, String(id));
  };

  const setTenantId = (id: number) => {
    setTenantIdState(id);
    window.localStorage.setItem(TENANT_KEY, String(id));
    setWorkspaceId(null); // workspace belongs to a tenant — reset on switch
  };

  // Drop a stale workspace selection that isn't in the current tenant's set.
  useEffect(() => {
    if (workspaceId != null && workspaces.length > 0 && !workspaces.some(w => w.id === workspaceId)) {
      setWorkspaceId(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspaces]);

  const value = useMemo<TenantContextValue>(() => ({
    tenantId, setTenantId, workspaceId, setWorkspaceId,
    tenants, workspaces, isAdmin, effectiveTenantId,
  }), [tenantId, workspaceId, tenants, workspaces, isAdmin, effectiveTenantId]);

  return <TenantContext.Provider value={value}>{children}</TenantContext.Provider>;
}

export function useTenantContext(): TenantContextValue {
  const ctx = useContext(TenantContext);
  if (!ctx) throw new Error("useTenantContext must be used within TenantProvider");
  return ctx;
}
