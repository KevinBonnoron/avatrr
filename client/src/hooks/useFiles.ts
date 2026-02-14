import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { filesClient } from '@/clients/files.client';

export function useModels() {
  return useQuery({
    queryKey: ['files', 'models'],
    queryFn: () => filesClient.listModels(),
  });
}

export function useAnimationFiles() {
  return useQuery({
    queryKey: ['files', 'animations'],
    queryFn: () => filesClient.listAnimations(),
  });
}

export function useUploadModel() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (file: File) => filesClient.uploadModel(file),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['files', 'models'] });
    },
  });
}

export function useUploadAnimation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (file: File) => filesClient.uploadAnimation(file),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['files', 'animations'] });
    },
  });
}

export function useSceneFiles() {
  return useQuery({
    queryKey: ['files', 'scenes'],
    queryFn: () => filesClient.listScenes(),
  });
}

export function useUploadScene() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (file: File) => filesClient.uploadScene(file),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['files', 'scenes'] });
    },
  });
}
