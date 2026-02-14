import { useQuery } from '@tanstack/react-query';
import { llmClient } from '@/clients/llm.client';

export function useLlmModels(name: string | null | undefined) {
  return useQuery({
    queryKey: ['llm', 'models', name],
    queryFn: () => llmClient.getLlmModels(name as string),
    enabled: !!name,
  });
}
