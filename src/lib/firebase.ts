import { initializeApp, getApps, getApp } from 'firebase/app';
import { 
  getAuth, 
  GoogleAuthProvider, 
  signInWithPopup, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut as firebaseSignOut, 
  onAuthStateChanged, 
  updateProfile,
  signInAnonymously,
  sendPasswordResetEmail,
  User 
} from 'firebase/auth';
import { 
  getFirestore, 
  doc, 
  getDoc, 
  setDoc, 
  collection, 
  getDocs, 
  deleteDoc, 
  onSnapshot, 
  serverTimestamp 
} from 'firebase/firestore';
import defaultFirebaseConfig from '../../firebase-applet-config.json';
import { UserProfile, ApplicationRecord } from '../types';
import { INITIAL_USER_PROFILE } from '../data/defaultProfile';
import { INITIAL_SAMPLE_APPLICATIONS } from '../data/sampleJobs';

// Strict validators for Firebase configuration fields
export function isValidApiKey(val: unknown): val is string {
  if (typeof val !== 'string') return false;
  const trimmed = val.trim();
  // Valid Google API keys start with AIzaSy and are at least 35 characters long
  return trimmed.startsWith('AIzaSy') && trimmed.length >= 35 && !trimmed.includes('REPLACE_WITH');
}

export function isValidProjectId(val: unknown): val is string {
  if (typeof val !== 'string') return false;
  const trimmed = val.trim();
  // Google Cloud Project IDs: 6-30 lowercase characters, digits, hyphens
  return /^[a-z][a-z0-9-]{4,28}[a-z0-9]$/.test(trimmed) && !trimmed.includes('your-');
}

export function isValidAppId(val: unknown): val is string {
  if (typeof val !== 'string') return false;
  const trimmed = val.trim();
  // Firebase Web App ID format: 1:<project-number>:web:<app-id>
  return /^1:\d+:web:[a-f0-9]+$/i.test(trimmed);
}

export function isValidAuthDomain(val: unknown): val is string {
  if (typeof val !== 'string') return false;
  const trimmed = val.trim();
  return trimmed.includes('.firebaseapp.com') && !trimmed.includes('your-');
}

export function isValidStorageBucket(val: unknown): val is string {
  if (typeof val !== 'string') return false;
  const trimmed = val.trim();
  return (trimmed.includes('.firebasestorage.app') || trimmed.includes('.appspot.com')) && !trimmed.includes('your-');
}

export function isValidMessagingSenderId(val: unknown): val is string {
  if (typeof val !== 'string') return false;
  const trimmed = val.trim();
  return /^\d{6,20}$/.test(trimmed);
}

// Support both environment variables (VITE_FIREBASE_*) and fallback to firebase-applet-config.json
const envProjectId = import.meta.env.VITE_FIREBASE_PROJECT_ID;
const envAppId = import.meta.env.VITE_FIREBASE_APP_ID;
const envApiKey = import.meta.env.VITE_FIREBASE_API_KEY;
const envAuthDomain = import.meta.env.VITE_FIREBASE_AUTH_DOMAIN;
const envDatabaseId = import.meta.env.VITE_FIREBASE_FIRESTORE_DATABASE_ID;
const envStorageBucket = import.meta.env.VITE_FIREBASE_STORAGE_BUCKET;
const envMessagingSenderId = import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID;
const envMeasurementId = import.meta.env.VITE_FIREBASE_MEASUREMENT_ID;
const envOAuthClientId = import.meta.env.VITE_FIREBASE_OAUTH_CLIENT_ID;
const envRecaptchaSiteKey = import.meta.env.VITE_FIREBASE_RECAPTCHA_SITE_KEY;

// Prefer authentic, valid Firebase credentials from firebase-applet-config.json or validated environment variables
const apiKey = isValidApiKey(defaultFirebaseConfig.apiKey)
  ? defaultFirebaseConfig.apiKey
  : (isValidApiKey(envApiKey) ? envApiKey : '');

const projectId = isValidProjectId(defaultFirebaseConfig.projectId)
  ? defaultFirebaseConfig.projectId
  : (isValidProjectId(envProjectId) ? envProjectId : 'gen-lang-client-0103599345');

const appId = isValidAppId(defaultFirebaseConfig.appId)
  ? defaultFirebaseConfig.appId
  : (isValidAppId(envAppId) ? envAppId : '');

const authDomain = isValidAuthDomain(defaultFirebaseConfig.authDomain)
  ? defaultFirebaseConfig.authDomain
  : (isValidAuthDomain(envAuthDomain) ? envAuthDomain : `${projectId}.firebaseapp.com`);

const firestoreDatabaseId = (defaultFirebaseConfig.firestoreDatabaseId && !defaultFirebaseConfig.firestoreDatabaseId.includes('your-') && !defaultFirebaseConfig.firestoreDatabaseId.includes('$'))
  ? defaultFirebaseConfig.firestoreDatabaseId
  : (envDatabaseId && !envDatabaseId.includes('your-') && !envDatabaseId.includes('$')
    ? envDatabaseId
    : 'ai-studio-49f27ecb-b053-4a8d-98b1-0f9445afb923');

const storageBucket = isValidStorageBucket(defaultFirebaseConfig.storageBucket)
  ? defaultFirebaseConfig.storageBucket
  : (isValidStorageBucket(envStorageBucket) ? envStorageBucket : `${projectId}.firebasestorage.app`);

const messagingSenderId = isValidMessagingSenderId(defaultFirebaseConfig.messagingSenderId)
  ? defaultFirebaseConfig.messagingSenderId
  : (isValidMessagingSenderId(envMessagingSenderId) ? envMessagingSenderId : '');

const oAuthClientId = (defaultFirebaseConfig.oAuthClientId && !defaultFirebaseConfig.oAuthClientId.includes('your-') && !defaultFirebaseConfig.oAuthClientId.includes('$'))
  ? defaultFirebaseConfig.oAuthClientId
  : (envOAuthClientId && !envOAuthClientId.includes('$') ? envOAuthClientId : '');

const firebaseConfig = {
  projectId,
  appId,
  apiKey,
  authDomain,
  firestoreDatabaseId,
  storageBucket,
  messagingSenderId,
  measurementId: defaultFirebaseConfig.measurementId || envMeasurementId || '',
  oAuthClientId,
  recaptchaSiteKey: defaultFirebaseConfig.recaptchaSiteKey || envRecaptchaSiteKey || ''
};

export const isFirebaseConfigured: boolean = Boolean(
  isValidProjectId(firebaseConfig.projectId) &&
  isValidApiKey(firebaseConfig.apiKey) &&
  isValidAppId(firebaseConfig.appId)
);

if (!isFirebaseConfigured) {
  console.warn(
    'Firebase is running with placeholder or unconfigured credentials. Local storage fallback will be active.'
  );
}

// Initialize Firebase App singleton safely
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

// Initialize Firebase Auth
export const auth = getAuth(app);

// Initialize Firestore with the provisioned named database
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId || '(default)');

// Google Auth Provider
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({
  prompt: 'select_account'
});

// Authentication Helpers
export async function loginWithGoogle(): Promise<User> {
  const result = await signInWithPopup(auth, googleProvider);
  return result.user;
}

export async function loginWithEmail(email: string, pass: string): Promise<User> {
  const result = await signInWithEmailAndPassword(auth, email, pass);
  return result.user;
}

export async function registerWithEmail(email: string, pass: string, displayName: string): Promise<User> {
  const result = await createUserWithEmailAndPassword(auth, email, pass);
  if (displayName) {
    await updateProfile(result.user, { displayName });
  }
  return result.user;
}

export async function loginAsGuest(): Promise<User> {
  const result = await signInAnonymously(auth);
  return result.user;
}

export async function resetPassword(email: string): Promise<void> {
  await sendPasswordResetEmail(auth, email);
}

export async function logoutUser(): Promise<void> {
  await firebaseSignOut(auth);
}

// User Profile Sync in Firestore: users/{userId}/profile/vault
export async function getUserProfileFromFirestore(userId: string): Promise<UserProfile | null> {
  try {
    const profileRef = doc(db, 'users', userId, 'profile', 'vault');
    const snap = await getDoc(profileRef);
    if (snap.exists()) {
      return snap.data() as UserProfile;
    }
    return null;
  } catch (err) {
    console.warn('Firestore profile fetch warning:', err);
    return null;
  }
}

export async function saveUserProfileToFirestore(userId: string, profile: UserProfile): Promise<void> {
  try {
    const profileRef = doc(db, 'users', userId, 'profile', 'vault');
    await setDoc(profileRef, {
      ...profile,
      updatedAt: new Date().toISOString()
    }, { merge: true });
  } catch (err) {
    console.error('Failed to save profile to Firestore:', err);
    throw err;
  }
}

// Applications Pipeline Sync in Firestore: users/{userId}/applications/{appId}
export async function getApplicationsFromFirestore(userId: string): Promise<ApplicationRecord[]> {
  try {
    const appsCol = collection(db, 'users', userId, 'applications');
    const snap = await getDocs(appsCol);
    const records: ApplicationRecord[] = [];
    snap.forEach((d) => {
      records.push({ ...(d.data() as ApplicationRecord), id: d.id });
    });
    return records;
  } catch (err) {
    console.warn('Firestore applications fetch warning:', err);
    return [];
  }
}

export async function saveApplicationToFirestore(userId: string, appRecord: ApplicationRecord): Promise<void> {
  try {
    const appRef = doc(db, 'users', userId, 'applications', appRecord.id);
    await setDoc(appRef, {
      ...appRecord,
      updatedAt: new Date().toISOString()
    }, { merge: true });
  } catch (err) {
    console.error('Failed to save application to Firestore:', err);
    throw err;
  }
}

export async function deleteApplicationFromFirestore(userId: string, appId: string): Promise<void> {
  try {
    const appRef = doc(db, 'users', userId, 'applications', appId);
    await deleteDoc(appRef);
  } catch (err) {
    console.error('Failed to delete application from Firestore:', err);
    throw err;
  }
}

// Initialize New User Workspace
export async function initializeUserWorkspace(user: User, preferSampleData: boolean = false): Promise<{
  profile: UserProfile;
  applications: ApplicationRecord[];
}> {
  const existingProfile = await getUserProfileFromFirestore(user.uid);
  if (existingProfile) {
    const existingApps = await getApplicationsFromFirestore(user.uid);
    return { profile: existingProfile, applications: existingApps };
  }

  // Brand new user: set up their profile customized to their authenticated account
  const newProfile: UserProfile = {
    ...INITIAL_USER_PROFILE,
    name: user.displayName || user.email?.split('@')[0] || 'Professional User',
    email: user.email || INITIAL_USER_PROFILE.email
  };

  await saveUserProfileToFirestore(user.uid, newProfile);

  // If user opted to seed with sample applications
  const starterApps = preferSampleData ? INITIAL_SAMPLE_APPLICATIONS : [];
  for (const app of starterApps) {
    await saveApplicationToFirestore(user.uid, app);
  }

  return { profile: newProfile, applications: starterApps };
}
