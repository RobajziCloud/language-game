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
  | { list?: string[] }
  | { items?: string[] }
  | { data?: string[] };

function ensureArray(v: unknown): string[] | null {
  if (Array.isArray(v) && v.every((x) => typeof x === "string")) return v as string[];
  return null;
}

/** Parser věty – akceptuje objekt i pole s jedním objektem */
function parseSentence(raw: any): Sentence | null {
  // pokud přijde pole, vezmeme první položku rekurzivně
  if (Array.isArray(raw)) {
    if (!raw.length) return null;
    return parseSentence(raw[0]);
  }

  if (!raw || typeof raw !== "object") return null;

  const toEnglishArray = (): string[] | null => {
    if (Array.isArray(raw.english) && raw.english.length && raw.english.every((w: any) => typeof w === "string")) {
      return raw.english as string[];
    }
    if (typeof raw.english === "string" && raw.english.trim()) {
      return raw.english.trim().split(/\s+/);
    }
    if (Array.isArray((raw as any).en)) {
      return (raw as any).en.filter((x: any) => typeof x === "string");
    }
    if (typeof (raw as any).sentence === "string" && (raw as any).sentence.trim()) {
      return (raw as any).sentence.trim().split(/\s+/);
    }
    return null;
  };

  const english = toEnglishArray();
  if (!english || !english.length) return null;

  const id =
    typeof raw.id === "string" && raw.id.trim()
      ? raw.id
      : (raw.id?.toString?.() ?? (globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`));

  const tokens: Token[] =
    Array.isArray(raw.tokens) && raw.tokens.length
      ? (raw.tokens as Token[])
      : english.map((w) => ({ w, pos: "", meaning: "" }));

  return {
    id,
    english,
    tokens,
    explanation: typeof raw.explanation === "string" ? raw.explanation : "",
  };
}

/** Z položky indexu vyrobí kandidátní URL pro fetch (vč. normalizace pomlček) */
function buildCandidatesFromIndexEntry(entry: string, level: Level): string[] {
  const candidates: string[] = [];
  const push = (u: string) => !candidates.includes(u) && candidates.push(u);

  // NORMALIZACE: en/em/figure dashes → '-'
  const e = entry.trim().replace(/[\u2012-\u2015]/g, "-");

  // Absolutní HTTP(S) s .json → použij přímo
  if (/^https?:\/\//i.test(e) && e.endsWith(".json")) {
    push(e);
    return candidates;
  }
  // Relativní cesta do /data s .json → použij přímo
  if (e.startsWith("/data/") && e.endsWith(".json")) {
    push(e);
    return candidates;
  }

  // Už obsahuje "sentences-" → doplň /data
  if (e.startsWith("sentences-")) {
    const base = e.endsWith(".json") ? e : `${e}.json`;
    push(`/data/${base}`); // /data/sentences-A2-1.json
  }

  // „A2-1“ → zkus preferenčně sentences-, pak další tvary
  if (/^[A-Za-z]\d-\d+$/.test(e)) {
    push(`/data/sentences-${e}.json`); // /data/sentences-A2-1.json
    push(`/data/${e}.json`);           // /data/A2-1.json
    const [, num] = e.split("-");
    if (num) push(`/data/${level}/${num}.json`); // /data/A2/1.json
  }

  // čisté číslo „1“ → odvozujeme z levelu
  if (/^\d+$/.test(e)) {
    push(`/data/sentences-${level}-${e}.json`);
    push(`/data/${level}/${e}.json`);
  }

  // „*.json“ bez /data → doplň /data
  if (e.endsWith(".json") && !e.startsWith("/")) {
    push(`/data/${e}`);
  }

  // nouzový fallback (zachytí třeba „A2/1.json“)
  if (candidates.length === 0) {
    push(`/data/${e}`);
  }

  return candidates;
}

/** Robustní načtení jedné věty s fallbacky cest */
async function fetchOneSentence(entry: string, level: Level): Promise<Sentence | null> {
  const candidates = buildCandidatesFromIndexEntry(entry, level);

  for (const url of candidates) {
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

/** Načtení indexu pro daný level s podporou různých struktur */
async function fetchIndex(level: Level): Promise<string[]> {
  const urls = [
    `/data/index-${level}.json`,
    `/data/${level}/index.json`,
    `/data/${level}/_index.json`,
  ];

  for (const url of urls) {
    try {
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) {
        console.warn("[SRC] Index nejde načíst:", url, res.status);
        continue;
      }
      const json: IndexPayload = await res.json();

      let list: string[] | null = null;
      if (Array.isArray(json)) list = ensureArray(json);
      if (!list && typeof json === "object" && json) {
        list =
          ensureArray((json as any).files) ??
          ensureArray((json as any).list) ??
          ensureArray((json as any).items) ??
          ensureArray((json as any).data) ??
          null;
      }

      if (list && list.length) {
        return list;
      }
      console.warn("[SRC] Index má nečekaný formát:", url, json);
    } catch (e) {
      console.warn("[SRC] Chyba při načítání indexu:", e);
    }
  }
  return [];
}

export function useSentenceSource(initialLevel: Level = "A2") {
  const [level, setLevelState] = useState<Level>(initialLevel);
  const [buffer, setBuffer] = useState<Sentence[]>([]);
  const [prefetching, setPrefetching] = useState(false);
  const indexRef = useRef<string[]>([]);
  const cursorRef = useRef<number>(0);

  // Při změně levelu natáhni index a přednačti pár vět
  useEffect(() => {
    let isActive = true;

    async function load() {
      setPrefetching(true);
      try {
        const index = await fetchIndex(level);

        indexRef.current = index.map((e) => (e ? e.replace(/[\u2012-\u2015]/g, "-") : e)); // jistota náhrady pomlček
        cursorRef.current = 0;

        // přednačti prvních pár vět (např. 3)
        const toPrefetch = indexRef.current.slice(0, 3);
        const next: Sentence[] = [];
        for (const entry of toPrefetch) {
          const s = await fetchOneSentence(entry, level);
          if (s) next.push(s);
        }
        if (isActive && next.length) {
          setBuffer(next);
        }
      } finally {
        if (isActive) setPrefetching(false);
      }
    }

    load();
    return () => {
      isActive = false;
    };
  }, [level]);

  const getNextSentence = useCallback(async (): Promise<Sentence | null> => {
    // pokud máme v bufferu, dej první
    if (buffer.length) {
      const [first, ...rest] = buffer;
      setBuffer(rest);
      return first;
    }

    // jinak dobij jednu další z indexu
    const index = indexRef.current;
    let i = cursorRef.current;

    while (index && i < index.length) {
      const entry = index[i++];
      const s = await fetchOneSentence(entry, level);
      if (s) {
        cursorRef.current = i;
        return s;
      }
      // když nevyšla, pokračuj dál
    }

    console.warn("[SRC] Index prázdný nebo konec seznamu.");
    cursorRef.current = i;
    return null;
  }, [buffer, level]);

  const setLevel = useCallback(
    (l: Level) => {
      if (l === level) return;
      setLevelState(l);
      // reset bufferu proběhne v useEffect výše
      setBuffer([]);
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
