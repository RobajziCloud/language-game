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
  try {
    const res = await fetch(url, { cache: "no-store" }); // pro jistotu ignoruj cache během vývoje
    if (!res.ok) {
      // 404 => další stránka neexistuje
      return { items: [], eof: res.status === 404 };
    }
    const data = await res.json();
    const items: Sentence[] = Array.isArray(data) ? data : Array.isArray(data?.items) ? data.items : [];
    return { items, eof: false };
  } catch (e) {
    console.warn("loadBatchFromPublic failed:", url, e);
    return { items: [], eof: false };
  }
}

export function useSentenceSource(initialLevel: Level) {
  const [level, setLevel] = useState<Level>(initialLevel);
  const [buffer, setBuffer] = useState<Sentence[]>([]);
  const [prefetching, setPrefetching] = useState(false);

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
        setBuffer((prev) => [...prev, ...items]);
      }
      return items;
    } finally {
      setPrefetching(false);
      inflightRef.current = false;
    }
  }, [level]);

  // Udržuj buffer doplněný; když klesne pod práh, přednačti
