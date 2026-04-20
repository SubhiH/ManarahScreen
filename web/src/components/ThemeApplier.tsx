import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

export default function ThemeApplier() {
  const { data } = useQuery({
    queryKey: ['public-settings'],
    queryFn: () => api.publicSettings(),
    refetchInterval: 30_000,
  });
  useEffect(() => {
    document.documentElement.dataset.theme = data?.theme ?? 'midnight';
  }, [data?.theme]);
  return null;
}
