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
  | string[]
  | { files?: string[] }
  | { items?: string[] }
  | { paths?: string[] };

function cryptoRandomId() {
  const c = (globalThis as any).crypto;
  if (c && typeof c.getRandomValues === "function") {
    const buf = new Uint32Array(2);
    c.getRandomValues(buf);
    return `${buf[0].toString(36)}${buf[1].toString(36)}`;
  }
  return Math.random().toString(36).slice(2);
}

function parseSentence(raw: any): Sentence | null {
  console.log("[SRC] Raw sentence:", raw);
  if (!raw || typeof raw !== "object") return null;

  if (Array.isArray(raw.english)) {
    const english = raw.english.filter((x: any) => typeof x === "string");
    if (!english.length) return null;
    return {
      id: String(raw.id ?? cryptoRandomId()),
      english,
      tokens:
        Array.isArray(raw.tokens) && raw.tokens.length
          ? (raw.tokens as Token[])
          : english.map((w) => ({ w, pos: "", meaning: "" })),
      explanation: typeof raw.explanation === "string" ? raw.explanation : "",
    };
  }

  let english: string[] | null = null;
  if (Array.isArray((raw as any).en)) english = (raw as any).en.filter((x: any) => typeof x === "string");
  if (!english && typeof raw.english === "string") english = raw.english.trim().split(/\s+/);
  if (!english && typeof (raw as any).sentence === "string") english = (raw as any).sentence.trim().split(/\s+/);

  if (english && english.length) {
    return {
      id: String(raw.id ?? cryptoRandomId()),
      english,
      tokens:
        Array.isArray(raw.tokens) && raw.tokens.length
          ? (raw.tokens as Token[])
          : english.map((w) => ({ w, pos: "", meaning: "" })),
      explanation: typeof raw.explanation === "string" ? raw.explanation : "",
    };
  }

  return null;
}

async function fetchIndex(level: Level): Promise<string[]> {
  const candidates = [
    `/data/index-${level}.json`,     // tvoje aktuální umístění
    `/index-${level}.json`,          // fallback
    `/data/${level}/index.json`,     // fallback
  ];

  for (const url of candidates) {
    try {
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) {
        console.warn(`[SRC] Nelze načíst index ${url}:`, res.status, res.statusText);
        continue;
      }
      const data: IndexPayload = await res.json();
      console.log(`[SRC] Index OK ${url}:`, data);

      if (Array.isArray(data)) return data;
      if (data && typeof data === "object") {
        const files =
          (Array.isArray((data as any).files) && (data as any).files) ||
          (Array.isArray((data as any).items) && (data as any).items) ||
          (Array.isArray((data as any).paths) && (data as any).paths) ||
          [];
        if (files.length) return files;
      }
    } catch (e) {
      console.warn(`[SRC] Chyba při čtení indexu ${url}:`, e);
    }
  }

  console.error(`[SRC] Nepodařilo se najít žádný index pro level ${level}.`);
  return [];
}

async function fetchSentence(path: string): Promise<Sentence | null> {
  const variants = [
    path,
    path.startsWith("/") ? path : `/${path}`,
    path.startsWith("data/") ? `/${path}` : `/data/${path}`,
  ];

  for (const url of variants) {
    try {
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) {
        console.warn("[SRC] Soubor nejde načíst:", url, res.status);
        continue;
      }
      const json = await res.json();
      const parsed = parseSentence(json);
      if (!parsed) {
        console.error("[SRC] Soubor nemá očekávaný formát (chybí english):", url, json);
        continue;
      }
      return parsed;
    } catch (e) {
      console.warn("[SRC] Chyba při načítání věty:", url, e);
    }
  }
  return null;
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
    const remaining = indexRef.current.filter((p) => !usedRef.current.has(p));
    if (remaining.length === 0) {
      usedRef.current.clear();
      const all = indexRef.current.slice();
      if (!all.length) return null;
      return all[Math.floor(Math.random() * all.length)];
    }
    return remaining[Math.floor(Math.random() * remaining.length)];
  }, []);

  const prefill = useCallback(async () => {
    if (prefetching) return;
    setPrefetching(true);

    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;

    try {
      if (!indexRef.current.length) {
        indexRef.current = await fetchIndex(level);
        usedRef.current.clear();
      }

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

  useEffect(() => {
    prefill();
  }, [level, prefill]);

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

  const setLevel = useCallback(
    (l: Level) => {
      if (l === level) return;
      abortRef.current?.abort();
      indexRef.current = [];
      usedRef.current.clear();
      setBuffer([]);
      setLevelState(l);
    },
    [level]
  );

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
