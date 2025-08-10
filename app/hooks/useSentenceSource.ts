"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

export const LEVELS = ["A2", "B1", "B2"] as const;
export type Level = (typeof LEVELS)[number];

export type Token = { w: string; pos: string; meaning: string };
export type Sentence = {
  id: string; // e.g. "A2-3"
  english: string[];
  tokens: Token[];
  explanation: string;
};

const BUFFER_TARGET = 3; // how many sentences to prefetch
const MAX_PROBE = 10; // fallback probing upper bound when manifest is missing

// HEAD request to check file existence
async function exists(url: string): Promise<boolean> {
  try {
    const res = await fetch(url, { method: "HEAD", cache: "force-cache" });
    return res.ok;
  } catch {
    return false;
  }
}

// Try to read manifest first; otherwise probe up to MAX_PROBE (supports 1..N and 01..0N)
async function discoverIds(level: Level): Promise<string[]> {
  // 1) Manifest
  try {
    const mf = await fetch(`/data/index-${level}.json`, { cache: "force-cache" });
    if (mf.ok) {
      const ids: string[] = await mf.json();
      if (Array.isArray(ids) && ids.length) return ids;
    }
  } catch {}

  // 2) Fallback: probe 1..MAX_PROBE (both plain and 0-padded filenames)
  const candidates: string[] = [];
  for (let i = 1; i <= MAX_PROBE; i++) {
    const plain = `/data/sentences-${level}-${i}.json`;
    const padded = `/data/sentences-${level}-${i.toString().padStart(2, "0")}.json`;
    // probe in parallel; accept whichever exists
    // eslint-disable-next-line no-await-in-loop
    const ok = (await exists(plain)) || (await exists(padded));
    if (ok) candidates.push(`${level}-${i}`);
  }
  return candidates;
}

async function fetchSentenceById(id: string): Promise<Sentence | null> {
  const [lvl, n] = id.split("-");
  const url1 = `/data/sentences-${lvl}-${n}.json`;
  const url2 = `/data/sentences-${lvl}-${Number(n).toString().padStart(2, "0")}.json`;
  try {
    const r1 = await fetch(url1, { cache: "no-cache" });
    if (r1.ok) return (await r1.json()) as Sentence;
    const r2 = await fetch(url2, { cache: "no-cache" });
    if (r2.ok) return (await r2.json()) as Sentence;
    return null;
  } catch {
    return null;
  }
}

export function useSentenceSource(initialLevel: Level) {
  const [level, setLevel] = useState<Level>(initialLevel);
  const [ids, setIds] = useState<string[]>([]);
  const [cursor, setCursor] = useState(0);
  const [buffer, setBuffer] = useState<Sentence[]>([]);
  const [prefetching, setPrefetching] = useState(false);
  const discoveringRef = useRef<Promise<void> | null>(null);

  const ensureDiscovered = useCallback(async () => {
    if (discoveringRef.current) return discoveringRef.current;
    discoveringRef.current = (async () => {
      const found = await discoverIds(level);
      setIds(found);
      setCursor(0);
    })();
    await discoveringRef.current;
    discoveringRef.current = null;
  }, [level]);

  const refill = useCallback(async () => {
    if (prefetching) return;
    setPrefetching(true);
    try {
      await ensureDiscovered();
      if (ids.length === 0) return;
      const work: Promise<Sentence | null>[] = [];
      let c = cursor;
      while (c < ids.length && work.length + buffer.length < BUFFER_TARGET) {
        const id = ids[c++];
        work.push(fetchSentenceById(id));
      }
      const results = await Promise.all(work);
      const next = results.filter(Boolean) as Sentence[];
      setBuffer((b) => [...b, ...next]);
      setCursor(c);
      if (c >= ids.length && ids.length > 0) setCursor(0); // loop
    } finally {
      setPrefetching(false);
    }
  }, [buffer.length, cursor, ensureDiscovered, ids, prefetching]);

  useEffect(() => {
    if (buffer.length < BUFFER_TARGET) void refill();
  }, [buffer.length, refill]);

  useEffect(() => {
    // level change → reset
    setIds([]);
    setCursor(0);
    setBuffer([]);
  }, [level]);

  const getNextSentence = useCallback(async () => {
    if (buffer.length === 0) await refill();
    const next = buffer[0] ?? null;
    if (next) setBuffer((b) => b.slice(1));
    void refill();
    return next;
  }, [buffer, refill]);

  return useMemo(() => ({ buffer, prefetching, setLevel, getNextSentence }), [buffer, prefetching, setLevel, getNextSentence]);
}
