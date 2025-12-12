import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyAPS88OETFvlq7_DtOhcF1V2VJeH_ZnFSs",
  authDomain: "wordgarden.firebaseapp.com",
  projectId: "wordgarden",
  storageBucket: "wordgarden.appspot.com",
  messagingSenderId: "287215877843",
  appId: "1:287215877843:web:9b5d68f4800baa11025e26"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
