import { auth } from './firebase';
import { telemetryService } from '../services/telemetryService';

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
  };
}

// Firestore/Firebase SDK hata kodlarından kullanıcıya gösterilecek kısa,
// Türkçe mesajlara eşleme. Ham SDK mesajları ("Missing or insufficient
// permissions", teknik JSON vb.) hiçbir zaman doğrudan kullanıcıya
// gösterilmemeli — tam detay yalnızca console.error + telemetri'ye gider.
const FRIENDLY_MESSAGES: Record<string, string> = {
  'permission-denied': 'Bu işlem için yetkiniz yok.',
  'not-found': 'Aradığınız kayıt bulunamadı.',
  'unavailable': 'Sunucuya şu anda ulaşılamıyor. İnternet bağlantınızı kontrol edip tekrar deneyin.',
  'deadline-exceeded': 'İşlem zaman aşımına uğradı. Lütfen tekrar deneyin.',
  'resource-exhausted': 'Dizge şu anda yoğun. Lütfen birkaç dakika sonra tekrar deneyin.',
  'unauthenticated': 'Oturumunuz sona ermiş. Lütfen tekrar giriş yapın.',
  'cancelled': 'İşlem iptal edildi.',
  'already-exists': 'Bu kayıt zaten mevcut.',
  'failed-precondition': 'Bu işlem şu anda gerçekleştirilemez. Sayfayı yenileyip tekrar deneyin.',
  'aborted': 'İşlem bir çakışma nedeniyle iptal edildi. Lütfen tekrar deneyin.',
  'internal': 'Beklenmeyen bir dizge hatası oluştu.',
  'unknown': 'Beklenmeyen bir hata oluştu.',
};
const DEFAULT_FRIENDLY_MESSAGE = 'Beklenmeyen bir hata oluştu. Lütfen tekrar deneyin.';

export function isFirebaseSdkError(error: unknown): error is { code: string; message: string } {
  return typeof error === 'object' && error !== null && typeof (error as { code?: unknown }).code === 'string';
}

/**
 * Bir hatadan kullanıcıya gösterilecek kısa Türkçe mesajı türetir.
 *  - Firebase SDK hataları (permission-denied vb.) → sabit, anlaşılır mesaj.
 *  - Uygulama içinde elle fırlatılan `Error`lar (ör. "Ezan vaktine 50
 *    dakikadan az kaldı...") zaten kullanıcıya yönelik olduğundan olduğu
 *    gibi korunur.
 */
function toUserMessage(error: unknown): string {
  if (isFirebaseSdkError(error)) {
    return FRIENDLY_MESSAGES[error.code] ?? DEFAULT_FRIENDLY_MESSAGE;
  }
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return DEFAULT_FRIENDLY_MESSAGE;
}

/**
 * Merkezi Firestore hata işleyicisi.
 * Teknik detay konsola ve telemetri servisine gider (sessiz hata kalmasın);
 * çağırana ise yalnızca kullanıcıya gösterilebilir kısa bir mesaj taşıyan
 * bir Error döner.
 */
export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): Error {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
    },
    operationType,
    path,
  };

  console.error('Firestore Error Detailed: ', JSON.stringify(errInfo));

  // Telemetri servisine ilet (statik, döngü riski yok)
  try {
    const wrappedError = error instanceof Error ? error : new Error(String(error));
    telemetryService.addBreadcrumb(
      `Firestore [${operationType}] hata: ${path ?? 'bilinmeyen yol'}`,
      'network',
      { path, operationType, uid: auth.currentUser?.uid ?? null }
    );
    telemetryService.logError(
      wrappedError,
      `Firestore ${operationType} @ ${path ?? 'unknown'}`
    );
  } catch (err) {
    /* telemetri servisine ulaşılamazsa sessizce devam et */
  }

  return new Error(toUserMessage(error));
}
