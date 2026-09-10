import { initializeApp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";
import { getAuth, setPersistence, browserLocalPersistence } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";
import { getFirestore, enableIndexedDbPersistence } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyB9lPb-I6I4RRGO9s-wNPvp1s3u8Nr4-hI",
  authDomain: "brain-training-tracker.firebaseapp.com",
  projectId: "brain-training-tracker",
  storageBucket: "brain-training-tracker.firebasestorage.app",
  messagingSenderId: "768684319007",
  appId: "1:768684319007:web:c0eea618fb06f68fd7502a",
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

setPersistence(auth, browserLocalPersistence).catch((err) => {
  console.error("Failed to set auth persistence", err);
});

enableIndexedDbPersistence(db).catch((err) => {
  console.warn("Firestore offline persistence unavailable", err.code);
});
