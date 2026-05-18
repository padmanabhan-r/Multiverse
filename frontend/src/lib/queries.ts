import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import type { Pack, PackListFilters, PackSample } from "@multiverse/shared";
import { api, type CreditsResponse } from "@/lib/api";

export function usePacks(
  filters: PackListFilters = {},
): UseQueryResult<Pack[]> {
  return useQuery({
    queryKey: ["packs", filters],
    queryFn: () => api.listPacks(filters),
    staleTime: 30_000,
  });
}

export function usePack(packId: string | undefined): UseQueryResult<Pack> {
  return useQuery({
    queryKey: ["pack", packId],
    queryFn: () => {
      if (!packId) throw new Error("packId required");
      return api.getPack(packId);
    },
    enabled: !!packId,
    staleTime: 60_000,
  });
}

export function usePackAccess(
  packId: string | undefined,
): UseQueryResult<{ owned: boolean; is_creator: boolean }> {
  return useQuery({
    queryKey: ["pack-access", packId],
    queryFn: () => {
      if (!packId) throw new Error("packId required");
      return api.packAccess(packId);
    },
    enabled: !!packId,
    staleTime: 30_000,
  });
}

export function usePackSamples(packId: string | undefined): UseQueryResult<PackSample[]> {
  return useQuery({
    queryKey: ["pack-samples", packId],
    queryFn: () => {
      if (!packId) throw new Error("packId required");
      return api.listSamples(packId);
    },
    enabled: !!packId,
    staleTime: 60_000,
  });
}

export function useMyCredits(
  opts: { enabled?: boolean } = {},
): UseQueryResult<CreditsResponse> {
  return useQuery({
    queryKey: ["me", "credits"],
    queryFn: () => api.myCredits(),
    staleTime: 15_000,
    enabled: opts.enabled ?? true,
    // Retry twice so transient 401s while the Clerk token is settling
    // don't leave the badge stuck at "Free".
    retry: 2,
    retryDelay: 250,
  });
}
