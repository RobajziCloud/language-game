"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

export const LEVELS = ["A2", "B1", "B2"] as const;
export type Level = (typeof LEVELS)[number];

export type Token = { w: string; pos: string; meaning: string };
export type Sentence = {
  id: string; // např. "A2-14"
  english: string[];
  tokens: Token[];
  explanation: string;
};

const MAX_PROBE = 60; // kolik souborů max. zkusíme najít (A2-1..60)
const BUFFER_TARGET = 3; // kolik vět držet v zásobníku

function pad2(n: number) {
  return n < 10 ? `0${n}` : String(n);
}

async function exists(url: string): Promise<boolean> {
  try {
    const res = await fetch(url, { method: "HEAD", cache: "force-cache" });
    return res.ok;
  } catch {
    return false;
  }
}

async function discoverIds(level: Level): Promise<string[]> {
  // 1) Pokud existuje manifest /data/index-<level>.json, použijeme ho
  try {
    const mf = await fetch(`/data/index-${level}.json`, { cache: "force-cache" });
    if (mf.ok) {
      const ids: string[] = await mf.json();
      if (Array.isArray(ids) && ids.length) return ids;
    }
  } catch {}

  // 2) Jinak prohledáme existující soubory – podporujeme jak bez nuly, tak s nulou
  const tasks: Promise<{ id: string; ok: boolean }>[] = [];
  for (let i = 1; i <= MAX_PROBE; i++) {
    const idPlain = `${level}-${i}`; // sentences-A2-14.json
    const idPadded = `${level}-${pad2(i)}`; // sentences-A2-14.json i 0x
    tasks.push(
      (async () => ({ id: idPlain, ok: await exists(`/data/sentences-${idPlain}.json`) || await exists(`/data/sentences-${idPadded}.json`) }))()
    );
  }
  const res = await Promise.all(tasks);
  const ids = res.filter(r => r.ok).map(r => r.id);
  return ids;
}

async function fetchSentenceById(id: string): Promise<Sentence | null> {
  // Zkusíme nejdřív bez nuly, pak s nulou
  const url1 = `/data/sentences-${id}.json`;
  const url2 = `/data/sentences-${id.replace(/-(\d)$/,"-0$1")}.json`;
  try {
    const r1 = await fetch(url1, { cache: "no-cache" });
    if (r1.ok) return await r1.json();
    const r2 = await fetch(url2, { cache: "no-cache" });
    if (r2.ok) return await r2.json();
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

  // Objeví dostupné ID pro daný level
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
      // když jsme na konci seznamu, začneme od začátku (nekonečný cyklus)
      if (c >= ids.length && ids.length > 0) setCursor(0);
    } finally {
      setPrefetching(false);
    }
  }, [buffer.length, cursor, ensureDiscovered, ids, prefetching]);

  // Automatické doplňování bufferu
  useEffect(() => {
    if (buffer.length < BUFFER_TARGET) {
      void refill();
    }
  }, [buffer.length, refill]);

  // Při změně levelu reset
  useEffect(() => {
    setIds([]);
    setCursor(0);
    setBuffer([]);
  }, [level]);

  const getNextSentence = useCallback(async () => {
    if (buffer.length === 0) {
      await refill();
    }
    const next = buffer[0] ?? null;
    if (next) setBuffer((b) => b.slice(1));
    // po vydání zkusíme znovu doplnit
    void refill();
    return next;
  }, [buffer, refill]);

  return useMemo(
    () => ({ buffer, prefetching, setLevel, getNextSentence }),
    [buffer, prefetching, setLevel, getNextSentence]
  );
}
