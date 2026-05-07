import { useQuery } from '@tanstack/react-query';

async function fetchHistory(type, limit) {
  const res = await fetch(`/api/signal-history?type=${encodeURIComponent(type)}&limit=${limit}`);
  if (!res.ok) throw new Error('signal-history fetch failed');
  const data = await res.json();
  if (data._error) throw new Error(JSON.stringify(data._error).slice(0, 120));
  return data.history || [];
}

export function useSignalHistory(type, { enabled = true, limit = 10 } = {}) {
  return useQuery({
    queryKey: ['signal-history', type, limit],
    queryFn: () => fetchHistory(type, limit),
    enabled: !!type && enabled,
    staleTime: 5 * 60_000,
    refetchOnWindowFocus: false,
    placeholderData: [],
  });
}
