import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyAs0OkHY48QWkef6jafsGR-iv48Vo3zFBM",
  authDomain: "nutripair-1a400.firebaseapp.com",
  projectId: "nutripair-1a400",
  storageBucket: "nutripair-1a400.firebasestorage.app",
  messagingSenderId: "310874451023",
  appId: "1:310874451023:web:30b811f5e3dc14de160e3a"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);