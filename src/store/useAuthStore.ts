import { create } from 'zustand';
import { onAuthStateChanged, User } from 'firebase/auth';
import { doc, onSnapshot, setDoc, deleteDoc, getDocFromServer } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';

let _authInitStarted = false;

interface AuthState {
 user: User | null;
 role: 'admin' | 'muezzin' | 'gozlemci' | null;
 isAdmin: boolean;
 isPending: boolean;
 loading: boolean;
 error: string | null;
 initialized: boolean;
 init: () => () => void;
 setError: (error: string | null) => void;
 setLoading: (loading: boolean) => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
 user: null,
 role: null,
 isAdmin: false,
 isPending: false,
 loading: false, // Start false to avoid initial flash, init will set it
 error: null,
 initialized: false,
 
 setError: (error) => set({ error }),
 setLoading: (loading) => set({ loading }),

 init: () => {
 if (get().initialized || _authInitStarted) return () => {};
 _authInitStarted = true;
 
 set({ loading: true });

 let unsubscribeDoc: (() => void) | null = null;
 let snapshotFailsafe: ReturnType<typeof setTimeout> | null = null;
 let authInitFailsafe: ReturnType<typeof setTimeout> | null = null;

 // Cold start failsafe: if Firebase Auth does not fire within 4.5 seconds (network lag, locked DB, etc.), force load
 authInitFailsafe = setTimeout(() => {
   if (!get().initialized) {
     console.warn('AuthStore: Cold start failsafe triggered (onAuthStateChanged took too long)');
     set({ loading: false, initialized: true });
   }
 }, 4500);

 const handleAuthStateChange = (currentUser: User | null) => {
 if (authInitFailsafe) {
   clearTimeout(authInitFailsafe);
   authInitFailsafe = null;
 }
 // Clean up previous doc listener AND any pending failsafe timer
 unsubscribeDoc?.();
 unsubscribeDoc = null;
 if (snapshotFailsafe) {
   clearTimeout(snapshotFailsafe);
   snapshotFailsafe = null;
 }

 // Only show loading if we are actually checking for a new user
 const currentStoreState = get();
 const shouldShowLoading = !currentStoreState.initialized || currentStoreState.user?.uid !== currentUser?.uid;
 
 set({ 
 user: currentUser, 
 error: null, 
 loading: currentUser ? shouldShowLoading : false 
 });

 if (!currentUser) {
 set({ role: null, isAdmin: false, isPending: false, loading: false, initialized: true });
 return;
 }

 // Failsafe: If snapshot doesn't arrive in 6 seconds, force-stop loading
 // This prevents being stuck on the splash screen indefinitely
 snapshotFailsafe = setTimeout(() => {
 if (get().loading) {
 console.warn('AuthStore: Snapshot failsafe triggered');
 set({ loading: false, initialized: true });
 }
 }, 6000);

 unsubscribeDoc = onSnapshot(
 doc(db, 'muezzins', currentUser.uid),
 async (docSnap) => {
 clearTimeout(snapshotFailsafe!);
 if (docSnap.exists()) {
 const data = docSnap.data();
 if (data.aktif === false) {
 set({ error: 'Hesabınız devre dışı bırakılmış.', role: null, isAdmin: false, loading: false, initialized: true });
 } else {
 set({ 
 role: data.role, 
 isAdmin: data.role === 'admin',
 isPending: !!data.onayBekliyor,
 loading: false,
 initialized: true 
 });
 }
 } else {
 // New user detection
 try {
 const currentEmail = currentUser.email?.toLowerCase().trim() || '';
 if (!currentEmail) {
 set({ error: 'Google hesabınızda bir e-posta adresi bulunamadı.', loading: false, initialized: true });
 return;
 }

 let inviteData: { displayName?: string; role?: 'admin' | 'muezzin' | 'gozlemci'; haftalikIzinGunu?: number } | null = null;

 // Süper-admin e-postaları config/bootstrap dokümanında tutulur (bkz. firestore.rules
 // isSuperAdminEmail ve scripts/seedSuperAdminConfig.ts).
 const bootstrapDoc = await getDocFromServer(doc(db, 'config', 'bootstrap'));
 const superAdminEmails: string[] = bootstrapDoc.exists()
 ? (bootstrapDoc.data().superAdminEmails || [])
 : [];
 const isSuperAdmin = superAdminEmails.includes(currentEmail);

 if (isSuperAdmin) {
 inviteData = { displayName: 'Baş Yönetici', role: 'admin' };
 } else {
 // Check invites collection
 const inviteRef = doc(db, 'invites', currentEmail);
 const inviteDoc = await getDocFromServer(inviteRef);
 if (inviteDoc.exists()) {
 inviteData = inviteDoc.data();
 }
 }

 if (!inviteData) {
 set({ 
 error: `Sistemde kaydınız bulunamadı. Lütfen yöneticiye e-postanızı (${currentEmail}) bildirin.`,
 loading: false,
 initialized: true
 });
 return;
 }

 const profileData = {
 displayName: inviteData.displayName || currentUser.displayName || 'İsimsiz Kullanıcı',
 aktif: true,
 aylikVakitSayisi: 0,
 role: inviteData.role || 'muezzin',
 fcmToken: '',
 photoURL: currentUser.photoURL || '',
 onayBekliyor: inviteData.role === 'admin' ? false : true,
 email: currentEmail,
 kayitTarihi: new Date().toISOString(),
 };

 if (typeof inviteData.haftalikIzinGunu === 'number') {
 (profileData as typeof profileData & { haftalikIzinGunu: number }).haftalikIzinGunu = inviteData.haftalikIzinGunu;
 }

 await setDoc(doc(db, 'muezzins', currentUser.uid), profileData);

 if (!isSuperAdmin) {
 await deleteDoc(doc(db, 'invites', currentEmail));
 }
 // loading will be set to false on the next snapshot trigger
 } catch (err) {
 console.error('AuthStore profile creation error:', err);
 set({ error: 'Profiliniz oluşturulurken bir hata oluştu.', loading: false, initialized: true });
 }
 }
 },
 (err) => {
 clearTimeout(snapshotFailsafe!);
 console.error('AuthStore role fetch error:', err);
 set({ loading: false, initialized: true });
 }
 );
 }; // end handleAuthStateChange

  let unsubscribeAuth = () => {};
  const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
  const mockUid = isLocalhost ? localStorage.getItem('TEST_USER_UID') : null;

  if (mockUid) {
    console.warn(`TEST MODE: Mocking auth for ${mockUid}`);
    handleAuthStateChange({
      uid: mockUid,
      email: `${mockUid}@example.test`,
      displayName: `Mock ${mockUid}`,
      photoURL: '',
    } as User);
  } else {
    unsubscribeAuth = onAuthStateChanged(auth, handleAuthStateChange);
  }

  return () => {
   unsubscribeAuth();
   unsubscribeDoc?.();
   if (snapshotFailsafe) clearTimeout(snapshotFailsafe);
   if (authInitFailsafe) clearTimeout(authInitFailsafe);
 };
 },
}));
