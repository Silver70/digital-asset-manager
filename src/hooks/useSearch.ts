import { useQuery } from "@tanstack/react-query";
import { searchAssets, type SearchParams } from "../api/search";

export function useSearchAssets(params: SearchParams, enabled: boolean) {
  return useQuery({
    queryKey: ["search", params],
    queryFn: () => searchAssets(params),
    enabled,
    staleTime: 5_000,
  });
}
