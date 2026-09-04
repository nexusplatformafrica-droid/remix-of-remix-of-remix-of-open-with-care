import { getApps, initializeApp, type FirebaseApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";
import { getFirestore, type Firestore } from "firebase/firestore";
import { firebaseConfig } from "./firebase-config";

export type FirebaseServices = { app: FirebaseApp; auth: Auth; db: Firestore };

let pending: Promise<FirebaseServices> | null = null;

/** Lazily boots Firebase in the browser using the static config. */
export function firebase(): Promise<FirebaseServices> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("Firebase is browser-only"));
  }
  if (!pending) {
    pending = (async () => {
      const app = getApps()[0] ?? initializeApp(firebaseConfig);
      const services: FirebaseServices = { app, auth: getAuth(app), db: getFirestore(app) };
      void import("firebase/analytics")
        .then(async ({ getAnalytics, isSupported }) => {
          if (await isSupported()) getAnalytics(app);
        })
        .catch(() => undefined);
      return services;
    })().catch((err) => {
      pending = null;
      throw err;
    });
  }
  return pending;
}

/** Friendly text for the Firebase auth error codes we can actually hit. */
export function authErrorMessage(err: unknown): string {
  const code = String((err as { code?: string })?.code ?? "");
  if (code.includes("invalid-credential") || code.includes("wrong-password"))
    return "Wrong phone number or password";
  if (code.includes("user-not-found")) return "No account found for that phone number";
  if (code.includes("email-already-in-use")) return "That phone number is already registered";
  if (code.includes("too-many-requests")) return "Too many attempts — please try again shortly";
  if (code.includes("network-request-failed")) return "Network problem — check your connection";
  if (code.includes("operation-not-allowed"))
    return "Email/password sign-in is not enabled in Firebase yet";
  if (code.includes("weak-password")) return "Password is too weak";
  const message = (err as { message?: string })?.message;
  return message ? message.replace(/^Firebase:\s*/, "") : "Something went wrong";
}
