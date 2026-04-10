import { initializeApp } from 'firebase/app';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getAuth, initializeAuth, getReactNativePersistence } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { Platform } from 'react-native';

const firebaseConfig = {
  apiKey: "AIzaSyAs0OkHY48QWkef6jafsGR-iv48Vo3zFBM",
  authDomain: "nutripair-1a400.firebaseapp.com",
  projectId: "nutripair-1a400",
  storageBucket: "nutripair-1a400.firebasestorage.app",
  messagingSenderId: "310874451023",
  appId: "1:310874451023:web:30b811f5e3dc14de160e3a"
};

const app = initializeApp(firebaseConfig);

// Persist Firebase auth sessions on native so users stay signed in across app restarts.
const authInstance =
  Platform.OS === 'web'
    ? getAuth(app)
    : (() => {
        try {
          return initializeAuth(app, {
            persistence: getReactNativePersistence(AsyncStorage),
          });
        } catch {
          return getAuth(app);
        }
      })();

export const auth = authInstance;
export const db = getFirestore(app);