import { initializeApp } from "firebase/app";
import { getAuth } from 'firebase/auth';
import { getFirestore } from "firebase/firestore";
import AsyncStorage from '@react-native-async-storage/async-storage';

// Your web app's Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyBveE3UNK5GaPcrtEh-eMgoa1Icuc18L6A",
    authDomain: "portfoy-otomasyon-58025.firebaseapp.com",
    projectId: "portfoy-otomasyon-58025",
    storageBucket: "portfoy-otomasyon-58025.firebasestorage.app",
    messagingSenderId: "289897807628",
    appId: "1:289897807628:web:6318fb8620635a02bc9329",
    measurementId: "G-P68FEJX9FT"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Auth
export const auth = getAuth(app);

export const db = getFirestore(app);
