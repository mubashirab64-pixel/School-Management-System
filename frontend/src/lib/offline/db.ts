/**
 * Offline draft storage — IndexedDB wrapper (Phase 1)
 * ----------------------------------------------------
 * SMS ke sabhi forms ke liye "Google Forms/Docs style" auto-save ka core.
 * Yahan sirf LOCAL storage handle hoti hai — server sync bilkul nahi (wo
 * Phase 4 mein SyncManager karega). IndexedDB disk-based hai, isliye
 * crash / refresh / tab close ke baad bhi draft safe rehta hai.
 *
 * Security: har draft `owner` (logged-in username) ke saath store hota hai
 * aur read/list par usi user ke drafts filter hote hain — shared school PCs
 * par ek user ke drafts doosre ko na dikhein. Logout par `clearAllDrafts()`.
 */

import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import { getCurrentUser } from "@/lib/permissions";

const DB_NAME = "SMS_OfflineDB";
const DB_VERSION = 1;
const STORE = "form_drafts";

export interface FormDraft<T = unknown> {
  /** Unique draft key, e.g. "add-student-draft" ya "edit-student-42". */
  id: string;
  /** Kis logged-in user ne banaya (username). Anonymous ke liye "_anon". */
  owner: string;
  /** Actual form data (koi bhi serializable object). */
  data: T;
  /** Last local save ka timestamp (ms). */
  lastModified: number;
  /** Server pe sync ho chuka? Phase 1-3 mein hamesha false. */
  synced: boolean;
  /** Duplicate-submission rokne ke liye stable UUID (Phase 4 mein use hoga). */
  clientRequestId: string;
}

interface OfflineDBSchema extends DBSchema {
  [STORE]: {
    key: string;
    value: FormDraft;
    indexes: { "by-owner": string; "by-synced": string };
  };
}

let dbPromise: Promise<IDBPDatabase<OfflineDBSchema>> | null = null;

function getDB() {
  // SSR guard — IndexedDB sirf browser mein hoti hai.
  if (typeof window === "undefined" || typeof indexedDB === "undefined") {
    return null;
  }
  if (!dbPromise) {
    dbPromise = openDB<OfflineDBSchema>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE)) {
          const store = db.createObjectStore(STORE, { keyPath: "id" });
          store.createIndex("by-owner", "owner");
          // `synced` boolean hai lekin IndexedDB boolean keys index nahi karti,
          // isliye SyncManager (Phase 4) pending drafts ko owner+synced flag se
          // list karega; index abhi future-proofing ke liye rakha hai.
          store.createIndex("by-synced", "owner");
        }
      },
    });
  }
  return dbPromise;
}

/** Current logged-in user ka stable identifier (draft scoping ke liye). */
function currentOwner(): string {
  return getCurrentUser()?.username || "_anon";
}

/** RFC4122-ish UUID — crypto available ho to use karo, warna fallback. */
export function generateClientRequestId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `crid-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

/**
 * Draft save/update karo. Agar pehle se hai to `clientRequestId` preserve
 * hota hai (taaki ek hi logical submission ka id stable rahe).
 */
export async function saveDraft<T>(
  id: string,
  data: T,
  opts?: { clientRequestId?: string }
): Promise<void> {
  const db = await getDB();
  if (!db) return;

  const owner = currentOwner();
  const existing = await db.get(STORE, id);
  const clientRequestId =
    opts?.clientRequestId ||
    existing?.clientRequestId ||
    generateClientRequestId();

  const draft: FormDraft<T> = {
    id,
    owner,
    data,
    lastModified: Date.now(),
    synced: false,
    clientRequestId,
  };
  await db.put(STORE, draft as FormDraft);
}

/**
 * Draft padho — sirf tab return karega jab wo current user ka ho
 * (doosre user ka draft dikhana leak hoga).
 */
export async function getDraft<T>(id: string): Promise<FormDraft<T> | null> {
  const db = await getDB();
  if (!db) return null;

  const draft = await db.get(STORE, id);
  if (!draft) return null;
  if (draft.owner !== currentOwner()) return null;
  return draft as FormDraft<T>;
}

/** Ek draft delete karo (submit success ya user "Discard" par). */
export async function deleteDraft(id: string): Promise<void> {
  const db = await getDB();
  if (!db) return;
  await db.delete(STORE, id);
}

/** Current user ke sabhi un-synced drafts (Phase 4 SyncManager ke liye). */
export async function listPendingDrafts(): Promise<FormDraft[]> {
  const db = await getDB();
  if (!db) return [];
  const owner = currentOwner();
  const all = await db.getAllFromIndex(STORE, "by-owner", owner);
  return all.filter((d) => !d.synced);
}

/**
 * Ek prefix se shuru hone waale current user ke sabhi drafts — Result Sheet
 * jaise per-row drafts (`<sheetId>::row::<studentId>`) ko group mein
 * list/restore karne ke liye.
 */
export async function listDraftsByPrefix<T = unknown>(
  prefix: string
): Promise<FormDraft<T>[]> {
  const db = await getDB();
  if (!db) return [];
  const owner = currentOwner();
  const all = await db.getAllFromIndex(STORE, "by-owner", owner);
  return all.filter((d) => d.id.startsWith(prefix)) as FormDraft<T>[];
}

/** Prefix se match karte current user ke sabhi drafts delete karo. */
export async function deleteDraftsByPrefix(prefix: string): Promise<void> {
  const db = await getDB();
  if (!db) return;
  const owner = currentOwner();
  const tx = db.transaction(STORE, "readwrite");
  const all = await tx.store.index("by-owner").getAll(owner);
  await Promise.all(
    all.filter((d) => d.id.startsWith(prefix)).map((d) => tx.store.delete(d.id))
  );
  await tx.done;
}

/**
 * Logout par sab kuch clear — kisi user ka data agle user ko na mile.
 * Poora store wipe karta hai (sirf current owner ka nahi) kyunki logout ke
 * baad `currentOwner()` badal chuka hota hai.
 */
export async function clearAllDrafts(): Promise<void> {
  const db = await getDB();
  if (!db) return;
  await db.clear(STORE);
}

/** Default draft umar — isse purane drafts app startup par khud delete. */
export const DEFAULT_DRAFT_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 din

/**
 * Housekeeping: `maxAgeMs` se purane drafts delete karo taaki IndexedDB
 * bharti na rahe. App startup par ek baar chalta hai (sabhi owners ke liye).
 * Deleted count return karta hai.
 */
export async function purgeExpiredDrafts(
  maxAgeMs: number = DEFAULT_DRAFT_TTL_MS
): Promise<number> {
  const db = await getDB();
  if (!db) return 0;
  const cutoff = Date.now() - maxAgeMs;
  const tx = db.transaction(STORE, "readwrite");
  const all = await tx.store.getAll();
  const expired = all.filter((d) => (d.lastModified ?? 0) < cutoff);
  await Promise.all(expired.map((d) => tx.store.delete(d.id)));
  await tx.done;
  return expired.length;
}
