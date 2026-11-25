import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, getQueryFn, queryClient } from "@/lib/queryClient";

export type AuthUser = {
  id: number;
  name: string;
  role: string;
  status: string;
  avatar: string | null;
  email: string | null;
};

export const AUTH_QUERY_KEY = ["/api/auth/me"];

/**
 * Drops every cached API response except the auth query, then sets the auth state.
 * The auth query itself is kept (not removed) so components observing it re-render.
 */
function resetSessionCache(user: AuthUser | null) {
  queryClient.removeQueries({ predicate: (query) => query.queryKey[0] !== AUTH_QUERY_KEY[0] });
  queryClient.setQueryData(AUTH_QUERY_KEY, user);
}

export function useCurrentUser() {
  return useQuery<AuthUser | null>({
    queryKey: AUTH_QUERY_KEY,
    queryFn: getQueryFn<AuthUser | null>({ on401: "returnNull" }),
  });
}

export function useLogin() {
  return useMutation({
    mutationFn: async (credentials: { email: string; password: string }) => {
      const res = await apiRequest("POST", "/api/auth/login", credentials);
      return (await res.json()) as AuthUser;
    },
    onSuccess: (user) => resetSessionCache(user),
  });
}

export function useLogout() {
  return useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/auth/logout");
    },
    onSettled: () => resetSessionCache(null),
  });
}
