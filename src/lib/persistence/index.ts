import type { DemoState } from "../demoState";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export interface SaveResult {
  ok: boolean;
  target: "browser" | "supabase";
  message: string;
  at: string;
}

export interface PersistenceAdapter {
  mode: "local" | "supabase";
  label: string;
  load(): Promise<DemoState | null>;
  save(state: DemoState): Promise<SaveResult>;
  clear(): Promise<void>;
}

const LOCAL_KEY = "s-compass-demo-v3";
const SESSION_KEY = "s-compass-session-id";

function now() {
  return new Date().toISOString();
}

function readLocal(): DemoState | null {
  try {
    const raw = window.localStorage.getItem(LOCAL_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as DemoState;
    return parsed?.version === 3 ? parsed : null;
  } catch {
    return null;
  }
}

function writeLocal(state: DemoState): SaveResult {
  try {
    window.localStorage.setItem(LOCAL_KEY, JSON.stringify(state));
    window.localStorage.setItem(SESSION_KEY, state.sessionId);
    return { ok: true, target: "browser", message: "Saved in this browser", at: now() };
  } catch (e) {
    return { ok: false, target: "browser", message: `Browser storage unavailable (${(e as Error).message}). Changes last until the tab is closed.`, at: now() };
  }
}

/** Stage 1: browser storage only. Works with no credentials. */
export const localAdapter: PersistenceAdapter = {
  mode: "local",
  label: "Demo Mode: saved in this browser only",
  async load() {
    return readLocal();
  },
  async save(state) {
    return writeLocal(state);
  },
  async clear() {
    try {
      window.localStorage.removeItem(LOCAL_KEY);
      window.localStorage.removeItem(SESSION_KEY);
    } catch {
      /* ignore */
    }
  },
};

/** Stage 2: Supabase. Same interface; the browser copy is kept as a cache. */
export function supabaseAdapter(url: string, anonKey: string): PersistenceAdapter {
  const client: SupabaseClient = createClient(url, anonKey, { auth: { persistSession: false } });
  let syncedEvents = new Set<string>();
  return {
    mode: "supabase",
    label: "Supabase persistence",
    async load() {
      const cached = readLocal();
      let sessionId: string | null = null;
      try {
        sessionId = window.localStorage.getItem(SESSION_KEY);
      } catch {
        sessionId = null;
      }
      if (!sessionId) return cached;
      const { data, error } = await client.from("demo_sessions").select("state").eq("id", sessionId).maybeSingle();
      if (error) throw new Error(`Could not load from Supabase: ${error.message}`);
      const remote = data?.state as DemoState | undefined;
      const state = remote?.version === 3 ? remote : cached;
      if (state) syncedEvents = new Set(state.events.map((e) => e.id));
      return state ?? null;
    },
    async save(state) {
      const local = writeLocal(state);
      const { error } = await client.from("demo_sessions").upsert({ id: state.sessionId, state, updated_at: now() });
      if (error) return { ok: false, target: "supabase", message: `Not saved to Supabase: ${error.message}. ${local.ok ? "A copy is kept in this browser only." : ""}`, at: now() };
      const fresh = state.events.filter((e) => !syncedEvents.has(e.id));
      if (fresh.length) {
        const rows = fresh.map((e) => ({
          id: e.id,
          session_id: e.sessionId,
          at: e.at,
          tester: e.tester,
          persona: e.persona,
          role: e.role,
          type: e.type,
          summary: e.summary,
          input: e.input ?? null,
          output: e.output ?? null,
          compute_ms: e.computeMs ?? null,
        }));
        const res = await client.from("interaction_events").insert(rows);
        if (res.error) return { ok: false, target: "supabase", message: `Session saved, but ${fresh.length} evidence events were not saved: ${res.error.message}`, at: now() };
        fresh.forEach((e) => syncedEvents.add(e.id));
      }
      return { ok: true, target: "supabase", message: "Saved to Supabase", at: now() };
    },
    async clear() {
      await localAdapter.clear();
      syncedEvents = new Set();
    },
  };
}

export function getAdapter(): PersistenceAdapter {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (url && key) {
    try {
      return supabaseAdapter(url, key);
    } catch {
      return localAdapter;
    }
  }
  return localAdapter;
}
