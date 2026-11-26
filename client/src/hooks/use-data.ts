import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";

export function useUsers() {
  return useQuery({ queryKey: ["/api/users"] });
}

export function useSites() {
  return useQuery({ queryKey: ["/api/sites"] });
}

export function useLocations() {
  return useQuery({ queryKey: ["/api/locations"] });
}

export function useStoreRooms() {
  return useQuery({ queryKey: ["/api/store-rooms"] });
}

export function useBins() {
  return useQuery({ queryKey: ["/api/bins"] });
}

export function useDashboardSummary() {
  return useQuery({ queryKey: ["/api/dashboard/summary"] });
}

export function useAssets() {
  return useQuery({ queryKey: ["/api/assets"] });
}

export function useAssetParts(assetId: string) {
  return useQuery({
    queryKey: ["/api/assets", assetId, "parts"],
    queryFn: async () => {
      const res = await fetch(`/api/assets/${assetId}/parts`);
      if (!res.ok) throw new Error("Failed to fetch parts");
      return res.json();
    },
    enabled: !!assetId,
  });
}

export function useInventory() {
  return useQuery({ queryKey: ["/api/inventory"] });
}

export function useSuppliers() {
  return useQuery({ queryKey: ["/api/suppliers"] });
}

export function useJobs() {
  return useQuery({ queryKey: ["/api/jobs"] });
}

export function useTemplates() {
  return useQuery({ queryKey: ["/api/templates"] });
}

export function useTransactions() {
  return useQuery({ queryKey: ["/api/transactions"] });
}

export function usePurchaseOrders() {
  return useQuery({ queryKey: ["/api/purchase-orders"] });
}

export function useAudits() {
  return useQuery({ queryKey: ["/api/audits"] });
}

export function useMaintenanceRequests() {
  return useQuery({ queryKey: ["/api/maintenance-requests"] });
}

/** Any write can change the dashboard figures, so they are always refreshed too. */
function invalidateAfterWrite(keys: string[]) {
  [...keys, "/api/dashboard/summary"].forEach(key => {
    queryClient.invalidateQueries({ queryKey: [key] });
  });
}

export function useCreateMutation(endpoint: string, invalidateKeys: string[]) {
  return useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", endpoint, data);
      return res.json();
    },
    onSuccess: () => {
      invalidateAfterWrite(invalidateKeys);
    },
  });
}

export function useUpdateMutation(endpoint: string, invalidateKeys: string[]) {
  return useMutation({
    mutationFn: async ({ id, data }: { id: string | number; data: any }) => {
      const res = await apiRequest("PATCH", `${endpoint}/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      invalidateAfterWrite(invalidateKeys);
    },
  });
}

export function useDeleteMutation(endpoint: string, invalidateKeys: string[]) {
  return useMutation({
    mutationFn: async (id: string | number) => {
      await apiRequest("DELETE", `${endpoint}/${id}`);
    },
    onSuccess: () => {
      invalidateAfterWrite(invalidateKeys);
    },
  });
}
