import { initializeApp } from "firebase/app";
import { getDatabase } from "firebase/database";

/*
  Firebase connection for:
  tiranga-game-92789

  This web API key is a Firebase client key. Database security is controlled
  by Firebase Realtime Database Rules, not by hiding this value.
*/
const firebaseConfig = {
  apiKey: "AIzaSyDsGV1wiIsPSk66Xrfworz93A9SeWetEDg",
  authDomain: "tiranga-game-92789.firebaseapp.com",
  databaseURL: "https://tiranga-game-92789-default-rtdb.firebaseio.com",
  projectId: "tiranga-game-92789",
  storageBucket: "tiranga-game-92789.firebasestorage.app",
  messagingSenderId: "505702236233",
  appId: "1:505702236233:web:6802172327421d67c43f98"
};

export const firebaseConfigured = true;
const app = initializeApp(firebaseConfig);
export const db = getDatabase(app);
