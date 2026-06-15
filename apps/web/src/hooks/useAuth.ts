import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { api } from '@/lib/api';
import { useAppStore } from '@/stores/app.store';
import type { LoginRequest, RegisterRequest } from '@ootd/types';

export function useAuth() {
  const { user, setAuth, clearAuth } = useAppStore();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const loginMutation = useMutation({
    mutationFn: (data: LoginRequest) => api.auth.login(data),
    onSuccess: ({ user, accessToken }) => {
      setAuth(user, accessToken);
      api.setAccessToken(accessToken);
      navigate('/dashboard');
    },
  });

  const registerMutation = useMutation({
    mutationFn: (data: RegisterRequest) => api.auth.register(data),
    onSuccess: ({ user, accessToken }) => {
      setAuth(user, accessToken);
      api.setAccessToken(accessToken);
      navigate('/dashboard');
    },
  });

  const logoutMutation = useMutation({
    mutationFn: () => api.auth.logout(),
    onSettled: () => {
      clearAuth();
      api.clearAccessToken();
      queryClient.clear();
      navigate('/');
    },
  });

  return {
    user,
    isAuthenticated: !!user,
    login: loginMutation.mutate,
    loginAsync: loginMutation.mutateAsync,
    register: registerMutation.mutate,
    registerAsync: registerMutation.mutateAsync,
    logout: logoutMutation.mutate,
    isLoggingIn: loginMutation.isPending,
    isRegistering: registerMutation.isPending,
    loginError: loginMutation.error,
    registerError: registerMutation.error,
  };
}
