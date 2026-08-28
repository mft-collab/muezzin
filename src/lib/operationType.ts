/**
 * Firestore işlem türü etiketi — hata raporlama/telemetride hangi tür
 * işlemin (okuma/yazma/silme...) başarısız olduğunu sınıflandırmak için
 * kullanılır. Hem istemci tarafı (`src/lib/firestore-errors.ts`) hem Admin
 * SDK cron script'leri (`scripts/lib/errors.ts`) bu AYNI enum'u kullanır —
 * önceden iki dosyada birebir kopya olarak tanımlıydı (bkz. kod denetimi);
 * bağımsız kalması drift riski taşıyordu. Bu dosyanın hiçbir bağımlılığı
 * yoktur (ne tarayıcıya ne Admin SDK'ya), bu yüzden her iki bağlamda da
 * güvenle import edilebilir.
 */
export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}
