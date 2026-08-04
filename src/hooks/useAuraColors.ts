import { useMemo } from 'react';
import { getActiveAuraColor, getSecondaryAuraColor } from '../lib/auraTheme';
import { Vakit } from '../types';

/** Mevcut vakte göre birincil ve ikincil sirkadiyen aura renklerini türetir. */
export function useAuraColors(mevcutVakit: Vakit | null) {
  const auraColor = useMemo(() => getActiveAuraColor(mevcutVakit), [mevcutVakit]);
  const secondaryAuraColor = useMemo(() => getSecondaryAuraColor(mevcutVakit), [mevcutVakit]);
  return { auraColor, secondaryAuraColor };
}
