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
 * Loader pro statické soubory v `public/data/`:
 * očekává soubory s názvem `sentences-<LEVEL>-<PAGE>.json` (např. sentences-A2-1.json).
 * JSON může být buď pole vět, nebo objekt { items: Sentence[] }.
 */
async function loadBatchFromPublic(level: Level, page: number): Promise<{ items: Sentence[]; eof: boolean }> {
  const url = `/data/sentences-${level}-${page}.json`;
  console.log("Loading sentences from:", url);
  try {
    const res = await fetch(url, { cache: "no-store" });
    console.log("Fetch status:", res.status);
    if (!res.ok) {
      // fallback na první stránku dané úrovně
      if (res.status === 404 && page !== 1) {
        console.warn("Falling back to page 1 for", level);
        return loadBatchFromPublic(level, 1);
      }
      return { items: [], eof: res.status === 404 };
    }
    const data = await res.json();
    const items: Sentence[] = Array.isArray(data) ? data : Array.isArray(data?.items) ? data.items : [];
    console.log("Loaded items count:", items.length);
    return { items, eof: false };
  } catch (e) {
    console.error("loadBatchFromPublic failed:", url, e);
    return { items: [], eof: false };
  }
}

export function useSentenceSource(initialLevel: Level) {
  const [level, setLevel] = useState<Level>(initialLevel);
  const [buffer, setBuffer] = useState<Sentence[]>([]);
  const [prefetching, setPrefetching] = useState(false);

  // Živá reference na buffer, aby se v callbackech nečetl zastaralý stav
  const bufferRef = useRef<Sentence[]>(buffer);
  useEffect(() => { bufferRef.current = buffer; }, [buffer]);

  // Udržujeme číslo stránky pro daný level; začínáme na 1
  const pageRef = useRef<number>(1);
  const inflightRef = useRef(false);
  const eofRef = useRef(false); // true, když narazíme na 404 pro aktuální level/page

  // Reset při změně levelu
  useEffect(() => {
    pageRef.current = 1;
    eofRef.current = false;
    setBuffer([]);
  }, [level]);

  const prefetch = useCallback(async (): Promise<Sentence[]> => {
    if (inflightRef.current) return [];
    inflightRef.current = true;
    setPrefetching(true);
    try {
      // Pokud jsme dojeli na konec (eof), začni znovu od první stránky, ať hra nikdy nezůstane bez dat
      if (eofRef.current) {
        pageRef.current = 1;
        eofRef.current = false;
      }

      const { items, eof } = await loadBatchFromPublic(level, pageRef.current);

      if (eof) {
        // značka konce – při příštím pokusu se wrapneme na začátek
        eofRef.current = true;
        return [];
      }

      if (items.length) {
        // posuň stránku až po úspěšném načtení
        pageRef.current += 1;
        // přidej do bufferu, ale vrať i volajícímu
        setBuffer((prev) => [...prev, ...items]);
      }
      return items;
    } finally {
      setPrefetching(false);
      inflightRef.current = false;
    }
  }, [level]);

  // Udržuj buffer doplněný; když klesne pod práh, přednačti
  useEffect(() => {
    const THRESHOLD = 3; // když zbývají ≤3 věty, dobij další stránku
    if (buffer.length <= THRESHOLD && !prefetching) {
      prefetch();
    }
  }, [buffer.length, prefetching, prefetch]);

  // Vrací další větu. Nep spoléhá se na propsání state – pokud je buffer prázdný,
  // vezme první větu přímo z návratové hodnoty prefetch() a zbytek dá do bufferu.
  const getNextSentence = useCallback(async (): Promise<Sentence | null> => {
    // 1) Máme něco hned teď?
    if (bufferRef.current.length > 0) {
      let next: Sentence | null = null;
      setBuffer((prev) => {
        if (prev.length === 0) return prev;
        next = prev[0];
        return prev.slice(1);
      });
      // paralelně dobij další dávku (nezdržuje UI)
      if (!prefetching && !inflightRef.current) prefetch();
      return next;
    }

    // 2) Nemáme → dotáhni batch a vrať PRVNÍ z něj hned, bez čekání na setState
    const batch = await prefetch();
    if (batch.length > 0) {
      const [first, ...rest] = batch;
      if (rest.length) setBuffer((prev) => [...prev, ...rest]);
      return first;
    }

    // Nic k dispozici – vrať null, UI má vlastní fallback
    return null;
  }, [prefetch, prefetching]);

  return useMemo(
    () => ({ buffer, prefetching, setLevel, getNextSentence }),
    [buffer, prefetching, setLevel, getNextSentence]
  );
}
