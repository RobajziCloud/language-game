// app/hooks/useSentenceSource.ts
"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

export const LEVELS = ["A2", "B1", "B2"] as const;
export type Level = (typeof LEVELS)[number];

export type Token = { w: string; pos: string; meaning: string };
export type Sentence = {
  id: string;
  english: string[];
  tokens: Token[];
  explanation: string;
};

type IndexPayload =
  | string[] // např. ["data/B1/sent-001.json", ...]
  | { files?: string[] } // např. { files: [...] }
  | { items?: string[] }
  | { paths?: string[] };

/** Bezpečný parser jedné věty – zkusí různé tvary a vždy vrátí validní Sentence, nebo null. */
function parseSentence(raw: any): Sentence | null {
  console.log("[SRC] Raw sentence:", raw);

  if (!raw || typeof raw !== "object") return null;

  // primární cesta: english = string[]
  if (Array.isArray(raw.english)) {
    const english: string[] = raw.english.filter((x: any) => typeof x === "string");
    if (!english.length) return null;
    return {
      id: String(raw.id ?? cryptoRandomId()),
      english,
      tokens:
        Array.isArray(raw.tokens) && raw.tokens.length
          ? raw.tokens
          : english.map((w) => ({ w, pos: "", meaning: "" })),
      explanation: typeof raw.explanation === "string" ? raw.explanation : "",
    };
  }

  // fallback: en: string[]  /  english: "one two ..."  /  sentence: "..."
  let english: string[] | null = null;
  if (Array.isArray(raw.en)) english = raw.en.filter((x: any) => typeof x === "string");
  if (!english && typeof raw.english === "string") english = raw.english.trim().split(/\s+/);
  if (!english && typeof raw.sentence === "string") english = raw.sentence.trim().split(/\s+/);

  if (english && english.length) {
    return {
      id: String(raw.id ?? cryptoRandomId()),
      english,
      tokens:
        Array.isArray(raw.tokens) && raw.tokens.length
          ? raw.tokens
          : english.map((w) => ({ w, pos: "", meaning: "" })),
      explanation: typeof raw.explanation === "string" ? raw.explanation : "",
    };
  }

  return null;
}

/** Přečte index a vrátí pole cest k větám. */
async function fetchIndex(level: Level): Promise<string[]> {
  const url = `/index-${level}.json`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) {
    console.error(`[SRC] Nelze načíst index ${url}:`, res.status, res.statusText);
    return [];
  }
  const data: IndexPayload = await res.json();
  console.log(`[SRC] Index ${url}:`, data);

  if (Array.isArray(data)) return data;
  if (data && typeof data === "object") {
    return (
      (Array.isArray((data as any).files) && (data as any).files) ||
      (Array.isArray((data as any).items) && (data as any).items) ||
      (Array.isArray((data as any).paths) && (data as any).paths) ||
      []
    );
  }
  return [];
}

async function fetchSentence(path: string): Promise<Sentence | null> {
  try {
    const res = await fetch(path, { cache: "no-store" });
    if (!res.ok) {
      console.warn("[SRC] Soubor nejde načíst:", path, res.status);
      return null;
    }
    const json = await res.json();
    const parsed = parseSentence(json);
    if (!parsed) {
      console.error("[SRC] Soubor nemá očekávaný formát (chybí english):", path, json);
      return null;
    }
    return parsed;
  } catch (e) {
    console.error("[SRC] Chyba při načítání věty:", path, e);
    return null;
  }
}

function cryptoRandomId() {
  // krátké unikátní id (fallback pro raw.id)
  if (typeof crypto?.getRandomValues === "function") {
    const buf = new Uint32Array(2);
    crypto.getRandomValues(buf);
    return `${buf[0].toString(36)}${buf[1].toString(36)}`;
  }
  return Math.random().toString(36).slice(2);
}

const BUFFER_SIZE = 4;

export function useSentenceSource(initialLevel: Level) {
  const [level, setLevelState] = useState<Level>(initialLevel);
  const [prefetching, setPrefetching] = useState(false);
  const [buffer, setBuffer] = useState<Sentence[]>([]);
  const indexRef = useRef<string[]>([]);
  const usedRef = useRef<Set<string>>(new Set());
  const abortRef = useRef<AbortController | null>(null);

  const pickNextPath = useCallback((): string | null => {
    const idx = indexRef.current.filter((p) => !usedRef.current.has(p));
    if (idx.length === 0) {
      // reset cyklu (použijeme věty znovu, ale promícháme)
      usedRef.current.clear();
      const all = indexRef.current.slice();
      if (all.length === 0) return null;
      return all[Math.floor(Math.random() * all.length)];
    }
    return idx[Math.floor(Math.random() * idx.length)];
  }, []);

  const prefill = useCallback(async () => {
    if (prefetching) return;
    setPrefetching(true);

    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;

    try {
      // Když nemáme index, načti
      if (!indexRef.current.length) {
        indexRef.current = await fetchIndex(level);
        usedRef.current.clear();
      }

      // Doplň frontu do BUFFER_SIZE
      const next: Sentence[] = [];
      while (!ac.signal.aborted && next.length + buffer.length < BUFFER_SIZE) {
        const path = pickNextPath();
        if (!path) break;
        usedRef.current.add(path);
        const s = await fetchSentence(path);
        if (ac.signal.aborted) break;
        if (s) next.push(s);
      }

      if (!ac.signal.aborted && next.length) {
        setBuffer((b) => [...b, ...next]);
      }
    } finally {
      if (!ac.signal.aborted) setPrefetching(false);
    }
  }, [level, pickNextPath, buffer.length, prefetching]);

  // Prefill na mount a při změně levelu
  useEffect(() => {
    prefill();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [level]);

  // Udržuj buffer plný
  useEffect(() => {
    if (buffer.length < Math.max(1, BUFFER_SIZE - 2)) {
      prefill();
    }
  }, [buffer.length, prefill]);

  const getNextSentence = useCallback((): Sentence | null => {
    if (buffer.length === 0) return null;
    const [first, ...rest] = buffer;
    setBuffer(rest);
    return first ?? null;
  }, [buffer]);

  const setLevel = useCallback((l: Level) => {
    if (l === level) return;
    abortRef.current?.abort();
    indexRef.current = [];
    usedRef.current.clear();
    setBuffer([]);
    setLevelState(l);
  }, [level]);

  return useMemo(
    () => ({
      buffer,
      prefetching,
      setLevel,
      getNextSentence,
    }),
    [buffer, prefetching, setLevel, getNextSentence]
  );
}
