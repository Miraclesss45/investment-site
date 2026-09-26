import { getFirestore } from "firebase/firestore";
import { firebaseApp } from "./firebase";

export const firestoreDb = firebaseApp ? getFirestore(firebaseApp) : null;
