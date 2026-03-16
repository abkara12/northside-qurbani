// lib/firebase.ts
import { initializeApp, getApps } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyCLkAWVGoWwmqkWe68Csfth3e1d5M-Kg7o",
  authDomain: "main-thehifdhjournal-fa34a.firebaseapp.com",
  projectId: "main-thehifdhjournal-fa34a",
  storageBucket: "main-thehifdhjournal-fa34a.firebasestorage.app",
  messagingSenderId: "532135430249",
  appId: "1:532135430249:web:b7f8f632744883c52d7af8"
};


const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
