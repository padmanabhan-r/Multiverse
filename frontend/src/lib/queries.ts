import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import type { Pack, PackListFilters } from "@multiverse-fm/shared";
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

export function useMyCredits(
  opts: { enabled?: boolean } = {},
): UseQueryResult<CreditsResponse> {
  return useQuery({
    queryKey: ["me", "credits"],
    queryFn: () => api.myCredits(),
    staleTime: 15_000,
    enabled: opts.enabled ?? true,
    retry: false,
  });
}
