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

/**
 * Merkezi Firestore hata işleyicisi.
 * Hataları hem konsola hem telemetri servisine iletir — sessiz hata kalmasın.
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

  const stringified = JSON.stringify(errInfo);
  console.error('Firestore Error Detailed: ', stringified);

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

  return new Error(stringified);
}
