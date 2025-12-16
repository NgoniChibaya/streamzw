import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getFirestore } from "firebase/firestore";

const firebaseConfig2 = {
  apiKey: "AIzaSyBIhBiO3flFpAcL2Fm_Ef22QQo6udFp5b4",
  authDomain: "react-netflix-eb4f0.firebaseapp.com",
  projectId: "react-netflix-eb4f0",
  storageBucket: "react-netflix-eb4f0.appspot.com",
  messagingSenderId: "29045190704",
  appId: "1:29045190704:web:a7c74bd778aa5f993c7df5",
  measurementId: "G-9TB7LL3YPM",
};

const firebaseConfig = {
  apiKey: "AIzaSyCOGDIDZNNCFMW-o4Msn_IUyVzDAT3ucBE",
  authDomain: "streamzw-d3c38.firebaseapp.com",
  projectId: "streamzw-d3c38",
  storageBucket: "streamzw-d3c38.firebasestorage.app",
  messagingSenderId: "978673522868",
  appId: "1:978673522868:web:d3deb50b50fa4131db9fe1",
  measurementId: "G-2JWS05LJ9F"
};

// Initialize Firebase
export const FirebaseApp = initializeApp(firebaseConfig);
export const db = getFirestore(FirebaseApp);
const analytics = getAnalytics(FirebaseApp);
