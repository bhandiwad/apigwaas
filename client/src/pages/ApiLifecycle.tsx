import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { ArrowRight, FileEdit, Rocket, AlertTriangle, Archive, CheckCircle2 } from "lucide-react";

const LIFECYCLE_STATES = [
  { key: "draft", label: "Draft", icon: FileEdit, color: "bg-gray-100 text-gray-700 border-gray-300", description: "API is being designed and configured" },
  { key: "published", label: "Published", icon: Rocket, color: "bg-green-100 text-green-700 border-green-300", description: "API is live and accepting traffic" },
  { key: "deprecated", label: "Deprecated", icon: AlertTriangle, color: "bg-yellow-100 text-yellow-700 border-yellow-300", description: "API is marked for sunset, consumers should migrate" },
  { key: "retired", label: "Retired", icon: Archive, color: "bg-red-100 text-red-700 border-red-300", description: "API is no longer accessible" },
];

const VALID_TRANSITIONS: Record<string, string[]> = {
  draft: ["published"],
  published: ["deprecated"],
  deprecated: ["published", "retired"],
  retired: [],
};

export default function ApiLifecycle() {
  const { data: tenants } = trpc.tenant.list.useQuery();
  const tenantId = tenants?.[0]?.id || 1;
  const { data: workspaces } = trpc.workspace.list.useQuery({ tenantId });
  const wsId = workspaces?.[0]?.id || 1;
  const { data: apis, refetch } = trpc.api.list.useQuery({ tenantId, workspaceId: wsId });
  const updateApi = trpc.api.update.useMutation({
    onSuccess: () => { refetch(); toast.success("API lifecycle state updated"); },
  });

  const getStateInfo = (status: string) => LIFECYCLE_STATES.find(s => s.key === status) || LIFECYCLE_STATES[0];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">API Lifecycle Management</h1>
        <p className="text-muted-foreground">Manage API state transitions from draft through retirement</p>
      </div>

      {/* Lifecycle State Machine Diagram */}
      <Card>
        <CardHeader><CardTitle>State Machine</CardTitle></CardHeader>
        <CardContent>
          <div className="flex items-center justify-center gap-2 py-4 flex-wrap">
            {LIFECYCLE_STATES.map((state, idx) => (
              <div key={state.key} className="flex items-center gap-2">
                <div className={`flex items-center gap-2 px-4 py-2 rounded-lg border-2 ${state.color}`}>
                  <state.icon className="w-4 h-4" />
                  <span className="font-medium text-sm">{state.label}</span>
                </div>
                {idx < LIFECYCLE_STATES.length - 1 && <ArrowRight className="w-5 h-5 text-gray-400" />}
              </div>
            ))}
          </div>
          <p className="text-center text-xs text-muted-foreground mt-2">
            Draft → Published → Deprecated → Retired (Deprecated can revert to Published)
          </p>
        </CardContent>
      </Card>

      {/* APIs by Lifecycle State */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {LIFECYCLE_STATES.map(state => {
          const stateApis = apis?.filter((a: any) => a.status === state.key) || [];
          return (
            <Card key={state.key}>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-base">
                  <state.icon className="w-4 h-4" />
                  {state.label}
                  <Badge variant="outline" className="ml-auto">{stateApis.length}</Badge>
                </CardTitle>
                <p className="text-xs text-muted-foreground">{state.description}</p>
              </CardHeader>
              <CardContent>
                {stateApis.length > 0 ? (
                  <div className="space-y-2">
                    {stateApis.map((api: any) => (
                      <div key={api.id} className="p-3 border rounded-lg bg-gray-50">
                        <div className="font-medium text-sm">{api.name}</div>
                        <div className="text-xs text-muted-foreground">v{api.version} • {api.protocol}</div>
                        <div className="flex gap-1 mt-2 flex-wrap">
                          {VALID_TRANSITIONS[state.key]?.map(target => {
                            const targetState = getStateInfo(target);
                            return (
                              <Button key={target} size="sm" variant="outline" className="text-xs h-7 px-2"
                                onClick={() => updateApi.mutate({ id: api.id, status: target as any })}
                                disabled={updateApi.isPending}>
                                → {targetState.label}
                              </Button>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground text-center py-4">No APIs in this state</p>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Version Promotion */}
      <Card>
        <CardHeader><CardTitle>Version Promotion History</CardTitle></CardHeader>
        <CardContent>
          {apis && apis.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left">
                    <th className="pb-3 font-medium">API</th>
                    <th className="pb-3 font-medium">Version</th>
                    <th className="pb-3 font-medium">Protocol</th>
                    <th className="pb-3 font-medium">Current State</th>
                    <th className="pb-3 font-medium">Available Transitions</th>
                  </tr>
                </thead>
                <tbody>
                  {apis.map((api: any) => {
                    const stateInfo = getStateInfo(api.status);
                    return (
                      <tr key={api.id} className="border-b last:border-0 hover:bg-gray-50">
                        <td className="py-3 font-medium">{api.name}</td>
                        <td className="py-3"><code className="bg-gray-100 px-2 py-0.5 rounded text-xs">{api.version}</code></td>
                        <td className="py-3"><Badge variant="outline">{api.protocol}</Badge></td>
                        <td className="py-3"><Badge className={stateInfo.color}>{stateInfo.label}</Badge></td>
                        <td className="py-3">
                          <div className="flex gap-1">
                            {VALID_TRANSITIONS[api.status]?.map(target => (
                              <Button key={target} size="sm" variant="outline" className="text-xs h-6 px-2"
                                onClick={() => updateApi.mutate({ id: api.id, status: target as any })}
                                disabled={updateApi.isPending}>
                                {getStateInfo(target).label}
                              </Button>
                            )) || <span className="text-xs text-muted-foreground">Terminal state</span>}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <CheckCircle2 className="w-10 h-10 mx-auto mb-3 opacity-50" />
              <p>No APIs found. Create APIs to manage their lifecycle.</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
