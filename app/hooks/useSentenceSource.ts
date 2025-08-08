"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

export type Token = { w: string; pos: string; meaning: string };
export type Sentence = {
  id: string;
  english: string[]; // správné pořadí slov
  tokens: Token[]; // tokeny se slovními druhy + významy
  explanation: string; // slovní vysvětlení věty
};

export const LEVELS = ["A2", "B1", "B2"] as const;
export type Level = (typeof LEVELS)[number];

/**
 * ***LOCKDOWN*** verze bez stránkování: vždy čte pouze
 *   /data/sentences-<LEVEL>-1.json
 * aby nikdy nevolala -2.json, -3.json atd.
 */
async function loadFromPublicSingle(level: Level): Promise<Sentence[]> {
  const url = `/data/sentences-${level}-1.json`;
  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) {
      console.warn("loadFromPublicSingle: HTTP", res.status, url);
      return [];
    }
    const data = await res.json();
    const items: Sentence[] = Array.isArray(data)
      ? data
      : Array.isArray((data as any)?.items)
      ? (data as any).items
      : [];
    return items;
  } catch (e) {
    console.error("loadFromPublicSingle failed:", e);
    return [];
  }
}

export function useSentenceSource(initialLevel: Level) {
  const [level, setLevel] = useState<Level>(initialLevel);
  const [buffer, setBuffer] = useState<Sentence[]>([]);
  const [prefetching, setPrefetching] = useState(false);

  // živá reference, abychom v callbacku nečetli zastaralý stav
  const bufferRef = useRef<Sentence[]>(buffer);
  useEffect(() => {
    bufferRef.current = buffer;
  }, [buffer]);

  const inflightRef = useRef(false);

  // při změně levelu vyčisti buffer
  useEffect(() => {
    setBuffer([]);
  }, [level]);

  const prefetch = useCallback(async (): Promise<Sentence[]> => {
    if (inflightRef.current) return [];
    inflightRef.current = true;
    setPrefetching(true);
    try {
      const items = await loadFromPublicSingle(level); // ***jen -1.json***
      if (items.length) {
        setBuffer((prev) => [...prev, ...items]);
      }
      return items;
    } finally {
      setPrefetching(false);
      inflightRef.current = false;
    }
  }, [level]);

  // drž buffer lehce naplněný
  useEffect(() => {
    const THRESHOLD = 1;
    if (buffer.length <= THRESHOLD && !prefetching) {
      prefetch();
    }
  }, [buffer.length, prefetching, prefetch]);

  // vrať další větu – buď z bufferu, nebo hned první z čerstvě načtené dávky
  const getNextSentence = useCallback(async (): Promise<Sentence | null> => {
    if (bufferRef.current.length > 0) {
      let next: Sentence | null = null;
      setBuffer((prev) => {
        if (prev.length === 0) return prev;
        next = prev[0];
        return prev.slice(1);
      });
      if (!prefetching && !inflightRef.current) prefetch();
      return next;
    }

    const batch = await prefetch();
    if (batch.length > 0) {
      const [first, ...rest] = batch;
      if (rest.length) setBuffer((prev) => [...prev, ...rest]);
      return first;
    }
    return null;
  }, [prefetch, prefetching]);

  return useMemo(
    () => ({ buffer, prefetching, setLevel, getNextSentence }),
    [buffer, prefetching, setLevel, getNextSentence]
  );
}
