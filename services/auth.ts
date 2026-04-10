import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged
} from 'firebase/auth';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { auth, db } from '../firebaseConfig';
import AsyncStorage from '@react-native-async-storage/async-storage';

const STAY_SIGNED_IN_KEY = 'auth:staySignedIn';

let memoryStaySignedIn: boolean | null = null;

export async function getStaySignedInPreference(): Promise<boolean> {
  if (memoryStaySignedIn !== null) return memoryStaySignedIn;
  try {
    const raw = await AsyncStorage.getItem(STAY_SIGNED_IN_KEY);
    if (raw === null) return true; // default: enabled
    return raw === 'true';
  } catch {
    return true;
  }
}

export async function setStaySignedInPreference(value: boolean): Promise<void> {
  memoryStaySignedIn = value;
  try {
    await AsyncStorage.setItem(STAY_SIGNED_IN_KEY, value ? 'true' : 'false');
  } catch {
    // ignore (e.g., storage unavailable)
  }
}

export async function signUp(email, password, name, calorieGoal) {
  const userCredential = await createUserWithEmailAndPassword(auth, email, password);
  const uid = userCredential.user.uid;
  const partnerCode = `NUTRI-${Math.floor(1000 + Math.random() * 9000)}`;

  await setDoc(doc(db, 'users', uid), {
      name,
      email,
      calorieGoal: Number(calorieGoal),
      partnerId: null,
      partnerCode,
      streak: 0,
      onboardingComplete: false,
      createdAt: new Date().toISOString()
    });

  return { uid, name, email, partnerCode };
}

export async function signIn(email, password) {
  const userCredential = await signInWithEmailAndPassword(auth, email, password);
  return userCredential.user;
}

export async function logOut() {
  await signOut(auth);
}

export function onAuthChange(callback) {
  return onAuthStateChanged(auth, callback);
}

export async function getUserProfile(uid) {
  const docSnap = await getDoc(doc(db, 'users', uid));
  if (docSnap.exists()) return { uid, ...docSnap.data() };
  return null;
}