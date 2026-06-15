import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { User, Avatar, WardrobeFilter } from '@ootd/types';

interface AppStore {
  // Auth
  user: User | null;
  accessToken: string | null;
  setAuth: (user: User, token: string) => void;
  clearAuth: () => void;

  // Avatar
  activeAvatar: Avatar | null;
  setActiveAvatar: (avatar: Avatar | null) => void;

  // Wardrobe UI
  wardrobeFilters: WardrobeFilter;
  setWardrobeFilters: (filters: Partial<WardrobeFilter>) => void;
  resetWardrobeFilters: () => void;

  // Theme
  theme: 'light' | 'dark' | 'system';
  setTheme: (theme: 'light' | 'dark' | 'system') => void;
}

const defaultWardrobeFilters: WardrobeFilter = {
  page: 1,
  limit: 20,
  isArchived: false,
};

export const useAppStore = create<AppStore>()(
  persist(
    (set) => ({
      user: null,
      accessToken: null,
      setAuth: (user, accessToken) => set({ user, accessToken }),
      clearAuth: () => set({ user: null, accessToken: null }),

      activeAvatar: null,
      setActiveAvatar: (activeAvatar) => set({ activeAvatar }),

      wardrobeFilters: defaultWardrobeFilters,
      setWardrobeFilters: (filters) =>
        set((state) => ({
          wardrobeFilters: { ...state.wardrobeFilters, ...filters },
        })),
      resetWardrobeFilters: () =>
        set({ wardrobeFilters: defaultWardrobeFilters }),

      theme: 'system',
      setTheme: (theme) => set({ theme }),
    }),
    {
      name: 'ootd-store',
      partialize: (state) => ({
        user: state.user,
        accessToken: state.accessToken,
        activeAvatar: state.activeAvatar,
        theme: state.theme,
      }),
    },
  ),
);
