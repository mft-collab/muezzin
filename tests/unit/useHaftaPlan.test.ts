import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

/**
 * `useHaftaPlan`'ın self-healing için kritik olan sözleşmesi:
 *  1. Dinleyici `includeMetadataChanges: true` ile kurulur — aksi halde
 *     "belge yok" durumunda önbellek→sunucu geçişi VERİ değiştirmediğinden
 *     callback bir daha hiç çağrılmaz ve `fromCache: false` asla görülmez.
 *  2. `sunucudanDogrulandi`, EN SON snapshot'ın `metadata.fromCache`
 *     değerini yansıtır (yapışkan değildir).
 *
 * bkz. src/lib/planSelfHealing.ts ve tests/unit/planSelfHealing.test.ts.
 */

const { onSnapshotMock } = vi.hoisted(() => ({ onSnapshotMock: vi.fn() }));

vi.mock('firebase/firestore', () => ({
  doc: (_db: unknown, ...segments: string[]) => ({ path: segments.join('/') }),
  onSnapshot: (...args: unknown[]) => onSnapshotMock(...args),
}));

vi.mock('../../src/lib/firebase', () => ({ db: {}, auth: {} }));

vi.mock('../../src/lib/firestore-errors', () => ({
  handleFirestoreError: vi.fn(),
  OperationType: { GET: 'GET', WRITE: 'WRITE' },
}));

const { useHaftaPlan } = await import('../../src/hooks/useHaftaPlan');

type SahteSnapshot = {
  id: string;
  exists: () => boolean;
  data: () => Record<string, unknown>;
  metadata: { fromCache: boolean; hasPendingWrites: boolean };
};

function snap(id: string, varMi: boolean, fromCache: boolean): SahteSnapshot {
  return {
    id,
    exists: () => varMi,
    data: () => ({ gunler: {}, durum: 'yayinda' }),
    metadata: { fromCache, hasPendingWrites: false },
  };
}

/** onSnapshot'a verilen veri callback'i (3. argüman). */
function veriCallback() {
  const args = onSnapshotMock.mock.calls[0];
  return args[2] as (s: SahteSnapshot) => void;
}

let haftaSayaci = 0;
/** Her test kendi haftaId'sini kullanır — modül seviyesindeki bellek-içi
 *  önbellek (globalHaftaPlanCache) testler arasında paylaşılıyor. */
function yeniHaftaId() {
  haftaSayaci += 1;
  return `WTEST-${haftaSayaci}`;
}

beforeEach(() => {
  onSnapshotMock.mockReset();
  onSnapshotMock.mockReturnValue(() => {});
});

describe('useHaftaPlan', () => {
  it('dinleyiciyi includeMetadataChanges: true ile kurar', () => {
    const haftaId = yeniHaftaId();
    renderHook(() => useHaftaPlan(haftaId));
    expect(onSnapshotMock).toHaveBeenCalledTimes(1);
    expect(onSnapshotMock.mock.calls[0][1]).toEqual({ includeMetadataChanges: true });
  });

  it('önbellekten gelen "plan yok" snapshot\'ı sunucudan doğrulanmış SAYILMAZ', () => {
    const haftaId = yeniHaftaId();
    const { result } = renderHook(() => useHaftaPlan(haftaId));
    const cb = veriCallback();

    act(() => cb(snap('W', false, true)));

    expect(result.current.plan).toBeNull();
    expect(result.current.loading).toBe(false);
    // Kritik: bu negatif okumaya GÜVENİLMEZ (self-healing tetiklenmemeli).
    expect(result.current.sunucudanDogrulandi).toBe(false);
  });

  it('sunucudan gelen "plan yok" snapshot\'ı doğrulanmış sayılır', () => {
    const haftaId = yeniHaftaId();
    const { result } = renderHook(() => useHaftaPlan(haftaId));
    const cb = veriCallback();

    // Önce önbellek (çevrimdışı açılış), sonra sunucu senkronu tamamlanır.
    act(() => cb(snap('W', false, true)));
    expect(result.current.sunucudanDogrulandi).toBe(false);

    act(() => cb(snap('W', false, false)));
    expect(result.current.plan).toBeNull();
    expect(result.current.sunucudanDogrulandi).toBe(true);
  });

  it('bağlantı koptuğunda bayrak tekrar false olur (yapışkan değil)', () => {
    const haftaId = yeniHaftaId();
    const { result } = renderHook(() => useHaftaPlan(haftaId));
    const cb = veriCallback();

    act(() => cb(snap('W', false, false)));
    expect(result.current.sunucudanDogrulandi).toBe(true);

    act(() => cb(snap('W', false, true)));
    expect(result.current.sunucudanDogrulandi).toBe(false);
  });

  it('var olan bir planı normal şekilde döndürür', () => {
    const haftaId = yeniHaftaId();
    const { result } = renderHook(() => useHaftaPlan(haftaId));
    const cb = veriCallback();

    act(() => cb(snap(haftaId, true, false)));

    expect(result.current.plan?.id).toBe(haftaId);
    expect(result.current.loading).toBe(false);
    expect(result.current.sunucudanDogrulandi).toBe(true);
  });
});
