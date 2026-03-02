// firebase.ts
import { initializeApp } from "firebase/app";
import {
  getAuth,
  initializeAuth,
  getReactNativePersistence,
  setPersistence,
  browserLocalPersistence,
} from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

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

let authentication;
if (Platform.OS === "web") {
  authentication = getAuth(app);
  setPersistence(authentication, browserLocalPersistence).catch((error) => {
    console.error("Firebase persistence error:", error);
  });
} else {
  authentication = initializeAuth(app, {
    persistence: getReactNativePersistence(AsyncStorage),
  });
}

const db = getFirestore(app);

export { authentication, db };
