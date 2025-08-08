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

// --- Pomocná funkce: načti balík vět pro daný level ---
async function loadBatch(level: Level): Promise<Sentence[]> {
  try {
    // Přizpůsob si endpoint podle projektu.
    // Očekává se odpověď tvaru: { items: Sentence[] }
    const res = await fetch(`/api/sentences?level=${level}`, { cache: "no-store" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return Array.isArray(data?.items) ? (data.items as Sentence[]) : [];
  } catch (e) {
    console.warn("loadBatch failed:", e);
    return [];
  }
}

export function useSentenceSource(initialLevel: Level) {
  const [level, setLevel] = useState<Level>(initialLevel);
  const [buffer, setBuffer] = useState<Sentence[]>([]);
  const [prefetching, setPrefetching] = useState(false);

  // Zamezí paralelním fetchům
  const inflightRef = useRef(false);

  const prefetch = useCallback(async (): Promise<Sentence[]> => {
    if (inflightRef.current) return [];
    inflightRef.current = true;
    setPrefetching(true);
    try {
      const items = await loadBatch(level);
      if (items.length) setBuffer((prev) => [...prev, ...items]);
      return items;
    } finally {
      setPrefetching(false);
      inflightRef.current = false;
    }
  }, [level]);

  // Když se změní level: vyčisti buffer a přednačti
  useEffect(() => {
    setBuffer([]);
    prefetch();
  }, [level, prefetch]);

  // Udržuj buffer doplněný (když klesne pod práh, přednačti)
  useEffect(() => {
    const THRESHOLD = 2; // když v bufferu zbývají <=2 věty, přednačti další
    if (buffer.length <= THRESHOLD && !prefetching) {
      prefetch();
    }
  }, [buffer.length, prefetching, prefetch]);

  // Vrací další větu. Pokud je buffer prázdný, zkusí rychlý fetch s timeoutem.
  const getNextSentence = useCallback(async (): Promise<Sentence | null> => {
    // 1) Máme něco v bufferu? Vrať hned.
    if (buffer.length > 0) {
      const [head, ...rest] = buffer;
      setBuffer(rest);
      return head;
    }

    // 2) Buffer je prázdný → zkus okamžitě přednačíst s krátkým čekáním
    const deadline = Date.now() + 1500; // ~1.5 s na rychlé doplnění
    let firstBatch: Sentence[] = [];

    if (!prefetching && !inflightRef.current) {
      firstBatch = await prefetch();
    }

    // Pokud hned po prefetchi nic nepřišlo, krátce polluj
    while (firstBatch.length === 0 && Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, 200));
      if (buffer.length > 0) break; // stav se změnil reaktivně
    }

    // Zkus znovu odebrat z bufferu (mohlo se mezitím naplnit)
    if (buffer.length > 0) {
      let next: Sentence | null = null;
      setBuffer((prev) => {
        if (prev.length === 0) return prev;
        next = prev[0];
        return prev.slice(1);
      });
      return next;
    }

    // Jako poslední šance: pokud jsme něco stáhli my (firstBatch), ale buffer
    // se ještě nestihl propsat, vezmi první a zbytek připoj do bufferu ručně.
    if (firstBatch.length > 0) {
      const [head, ...rest] = firstBatch;
      if (rest.length) setBuffer((prev) => [...prev, ...rest]);
      return head;
    }

    // Nic není k dispozici.
    return null;
  }, [buffer, prefetch, prefetching]);

  return useMemo(
    () => ({ buffer, prefetching, setLevel, getNextSentence }),
    [buffer, prefetching, setLevel, getNextSentence]
  );
}
