"use client";
import { useEffect, useRef, useState } from "react";

export const LEVELS = ["A2", "B1", "B2"] as const;
export type Level = typeof LEVELS[number];

type Token = { w: string; pos: string; meaning: string };
export type Sentence = {
  id: string;
  level: string;
  topic: string;
  english: string[];
  tokens: Token[];
  explanation: string;
};

type SourceState = {
  level: Level;
  page: number;
  buffer: Sentence[];
  prefetching: boolean; // interní nedebouncovaný stav
};

async function fetchShard(level: string, page: number): Promise<Sentence[]> {
  const url = `/data/sentences-${level}-${page}.json`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`Nepodařilo se načíst ${url}`);
  return res.json();
}

/**
 * Hook pro načítání vět po shardech (JSON v /public/data).
 * - Resetuje zdroj při změně levelu
 * - Prefetchuje další stránku, když v bufferu zbývá ≤ 1 věta
 * - Zobrazení "Načítám…" je debouncované (300 ms), aby neblikalo
 */
export function useSentenceSource(initialLevel: Level) {
  const [state, setState] = useState<SourceState>({
    level: initialLevel,
    page: 1,
    buffer: [],
    prefetching: false,
  });

  // zámek proti souběžným fetchům
  const inflightRef = useRef(false);
  // debouncovaný indikátor pro UI
  const [prefetchVisible, setPrefetchVisible] = useState(false);
  const nextPageRef = useRef(2);

  // 1) Na změnu levelu vyžádáme první shard (page 1)
  useEffect(() => {
    let cancelled = false;

    setState({ level: initialLevel, page: 1, buffer: [], prefetching: true });
    nextPageRef.current = 2;
    inflightRef.current = true;

    fetchShard(initialLevel, 1)
      .then((data) => {
        if (cancelled) return;
        setState((s) => ({ ...s, buffer: data }));
      })
      .catch((err) => {
