import { useVakitStore } from '../store/useVakitStore';

export function useEzanVakitleri() {
  const { bugunVakitler, yarinVakitler, loading } = useVakitStore();
  return { bugunVakitler, yarinVakitler, loading };
}
