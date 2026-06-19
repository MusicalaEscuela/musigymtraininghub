import { CONFIG } from "./config.js";
import { normalizeText, safeText } from "./utils.js";

import {
  initializeApp,
  getApps,
  getApp,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";

import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

import {
  initializeFirestore,
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  addDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  serverTimestamp,
  Timestamp,
  writeBatch,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const app = getApps().length ? getApp() : initializeApp(CONFIG.firebase);
const auth = getAuth(app);
const db = initializeFirestore(app, {
  experimentalAutoDetectLongPolling: true,
  useFetchStreams: false,
});
const provider = new GoogleAuthProvider();
provider.setCustomParameters({ prompt: "select_account" });

// Segunda app de Firebase: proyecto de la Biblioteca de recursos (solo lectura).
const LIB_APP_NAME = "biblioteca";
const libraryApp = getApps().find((a) => a.name === LIB_APP_NAME)
  || initializeApp(CONFIG.libraryFirebase, LIB_APP_NAME);
const libraryDb = initializeFirestore(libraryApp, {
  experimentalAutoDetectLongPolling: true,
  useFetchStreams: false,
});

// Lee todos los recursos de la biblioteca externa. Lectura publica, sin login.
export async function fetchResourceLibrary() {
  const snap = await getDocs(collection(libraryDb, "recursos"));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export {
  app,
  auth,
  db,
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  addDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  serverTimestamp,
  Timestamp,
  writeBatch,
};

export function loginWithGoogle() {
  return signInWithPopup(auth, provider);
}

export function logout() {
  return signOut(auth);
}

export function observeAuth(callback) {
  return onAuthStateChanged(auth, callback);
}

export function isBootstrapAdmin(email) {
  const target = normalizeText(email);
  return CONFIG.access.bootstrapAdminEmails.some((candidate) => normalizeText(candidate) === target);
}

export function normalizeUser(user) {
  if (!user) return null;
  return {
    uid: user.uid,
    name: user.displayName || "Usuario Musicala",
    email: user.email || "",
    photoURL: user.photoURL || "",
  };
}

export async function getUserProfile(user) {
  const cleanUser = normalizeUser(user);
  if (!cleanUser) return null;

  const id = safeText(cleanUser.email || cleanUser.uid).toLowerCase();
  const ref = doc(db, CONFIG.collections.users, id);
  const snap = await getDoc(ref).catch(() => null);
  const saved = snap?.exists() ? snap.data() : {};
  const bootstrapAdmin = isBootstrapAdmin(cleanUser.email);
  const role = bootstrapAdmin ? "admin" : saved.role || "estudiante";

  const profile = {
    id,
    ...cleanUser,
    ...saved,
    role,
    isAdmin: role === "admin",
    isTeacher: role === "docente" || saved.isMusiGymTeacher === true,
    isStudent: role === "estudiante",
    bootstrapAdmin,
  };

  await setDoc(
    ref,
    {
      uid: cleanUser.uid,
      name: cleanUser.name,
      email: cleanUser.email,
      photoURL: cleanUser.photoURL,
      role,
      isMusiGymTeacher: saved.isMusiGymTeacher === true,
      lastLoginAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      createdAt: saved.createdAt || serverTimestamp(),
    },
    { merge: true }
  ).catch((error) => {
    console.warn("No se pudo guardar perfil de usuario", error);
  });

  return profile;
}
