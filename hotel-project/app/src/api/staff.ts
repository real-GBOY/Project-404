import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ENDPOINTS, http } from "@/config";

export interface StaffMember {
  userId: string;
  name: string;
  email: string;
  roleKey: string | null;
  roleName: string | null;
  status: "active" | "pending" | "disabled";
  joinedAt: string;
  lastActiveAt: string | null;
}

export interface RoleMatrix {
  permissions: Array<{ key: string; action: string; resource: string; description: string | null }>;
  roles: Array<{ key: string; name: string; description: string | null; permissionKeys: string[] }>;
}

export interface AddStaffInput {
  fullName: string;
  email: string;
  roleKey: string;
  temporaryPassword: string;
}

export const staffKeys = {
  list: ["staff"] as const,
  roles: ["roles"] as const,
  myRole: ["my-role"] as const,
};

export function useMyRole(enabled: boolean) {
  return useQuery({
    queryKey: staffKeys.myRole,
    queryFn: () => http<{ roleKey: string | null; roleName: string | null }>(ENDPOINTS.myRole),
    enabled,
    staleTime: 5 * 60_000,
  });
}

export function useStaff() {
  return useQuery({
    queryKey: staffKeys.list,
    queryFn: async () => (await http<{ items: StaffMember[] }>(ENDPOINTS.staff.list)).items,
  });
}

export function useRoleMatrix() {
  return useQuery({ queryKey: staffKeys.roles, queryFn: () => http<RoleMatrix>(ENDPOINTS.roles) });
}

export function useAddStaff() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: AddStaffInput) =>
      http<{ userId: string }>(ENDPOINTS.staff.list, { method: "POST", body: input }),
    onSuccess: () => qc.invalidateQueries({ queryKey: staffKeys.list }),
  });
}

export function useChangeRole() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, roleKey }: { userId: string; roleKey: string }) =>
      http(ENDPOINTS.staff.role(userId), { method: "PUT", body: { roleKey } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: staffKeys.list }),
  });
}

export function useRemoveStaff() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) => http(ENDPOINTS.staff.remove(userId), { method: "POST" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: staffKeys.list }),
  });
}
