// firebase.ts
import { initializeApp } from "firebase/app";
import {
  getAuth,
  setPersistence,
  browserLocalPersistence,
} from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyDw0ofhfcZs4e6RH9QzkMObt8zjTv3Zz4M",
  authDomain: "alldrive-34548.firebaseapp.com",
  projectId: "alldrive-34548",
  storageBucket: "alldrive-34548.appspot.com",
  messagingSenderId: "102013068632",
  appId: "1:102013068632:web:f027e887b5eb8f9d18f12d",
  measurementId: "G-LLSSR0N84W",
};

const app = initializeApp(firebaseConfig);
const authentication = getAuth(app);

// Ensure persistent login
setPersistence(authentication, browserLocalPersistence).catch((error) => {
  console.error("Firebase persistence error:", error);
});

export { authentication };
