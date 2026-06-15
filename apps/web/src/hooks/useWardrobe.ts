import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAppStore } from '@/stores/app.store';
import type { CreateClothingItemRequest } from '@ootd/types';

export function useWardrobe() {
  const { wardrobeFilters } = useAppStore();
  const queryClient = useQueryClient();

  const listQuery = useQuery({
    queryKey: ['wardrobe', wardrobeFilters],
    queryFn: () => api.wardrobe.list(wardrobeFilters),
  });

  const uploadMutation = useMutation({
    mutationFn: ({ file, meta }: { file: File; meta?: CreateClothingItemRequest }) => {
      const formData = new FormData();
      formData.append('image', file);
      return api.wardrobe.upload(formData, meta);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['wardrobe'] }),
  });

  const importUrlMutation = useMutation({
    mutationFn: ({ url, meta }: { url: string; meta?: CreateClothingItemRequest }) =>
      api.wardrobe.importUrl(url, meta),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['wardrobe'] }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.wardrobe.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['wardrobe'] }),
  });

  const archiveMutation = useMutation({
    mutationFn: (id: string) => api.wardrobe.archive(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['wardrobe'] }),
  });

  return {
    items: listQuery.data?.data ?? [],
    total: listQuery.data?.total ?? 0,
    isLoading: listQuery.isLoading,
    error: listQuery.error,
    upload: uploadMutation.mutateAsync,
    importUrl: importUrlMutation.mutateAsync,
    deleteItem: deleteMutation.mutate,
    archiveItem: archiveMutation.mutate,
    isUploading: uploadMutation.isPending,
  };
}
