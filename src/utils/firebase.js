import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  projectId: "alnaseem-field-reports",
  appId: "1:343899326790:web:df4efdff847d2a7404bd47",
  storageBucket: "alnaseem-field-reports.firebasestorage.app",
  apiKey: "AIzaSyA6bO1SGqiLuM2h29oTOM_WeVYZpg3oZS4",
  authDomain: "alnaseem-field-reports.firebaseapp.com",
  messagingSenderId: "343899326790",
  measurementId: "G-TGRSL8Z7H6"
};

// Initialize Firebase App singleton
const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

// Initialize Cloud Firestore
export const db = getFirestore(app);
export default app;
