import { useAuthStore } from '../store/useAuthStore';

/**
 * @deprecated Use useAuthStore() instead for better performance and centralized state.
 */
export function useRole() {
  const role = useAuthStore(state => state.role);
  const isAdmin = useAuthStore(state => state.isAdmin);
  const loading = useAuthStore(state => state.loading);
  return { role, isAdmin, loading };
}
