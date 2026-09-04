/**
 * Resolves the AllSportsAPI key used by every server-side data call.
 *
 * Priority: value saved by an admin in the dashboard (site/settings document)
 * → ALLSPORTS_API_KEY env var → built-in default. The Firestore lookup uses the
 * REST API because the Firebase SDK is browser-only.
 */
import { firebaseConfig } from "./firebase-config";

const DEFAULT_KEY = "9e1d457ef257f5c370a7d19fc5b2b2746a3e6b9058a0e60f8ce40cb58fadb966";

let cached: { at: number; key: string } | null = null;

export async function allsportsApiKey(): Promise<string> {
  if (cached && Date.now() - cached.at < 60_000) return cached.key;

  const fallback = process.env["ALLSPORTS_API_KEY"] ?? DEFAULT_KEY;
  let key = fallback;
  try {
    const url =
      `https://firestore.googleapis.com/v1/projects/${firebaseConfig.projectId}` +
      `/databases/(default)/documents/site/settings?mask.fieldPaths=allsportsApiKey&key=${firebaseConfig.apiKey}`;
    const res = await fetch(url);
    if (res.ok) {
      const body = (await res.json()) as {
        fields?: { allsportsApiKey?: { stringValue?: string } };
      };
      const saved = body.fields?.allsportsApiKey?.stringValue?.trim();
      if (saved) key = saved;
    }
  } catch {
    /* keep the fallback key */
  }

  cached = { at: Date.now(), key };
  return key;
}
