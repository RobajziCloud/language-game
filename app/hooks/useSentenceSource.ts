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
  prefetching: boolean;
};

async function fetchShard(level: string, page: number): Promise<Sentence[]> {
  const url = `/data/sentences-${level}-${page}.json`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`Nepodařilo se načíst ${url}`);
  return res.json();
}

export function useSentenceSource(initialLevel: Level) {
  const [state, setState] = useState<SourceState>({
    level: initialLevel,
    page: 1,
    buffer: [],
    prefetching: false,
  });

  const inflightRef = useRef(false);
  const nextPageRef = useRef(2);

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
      .catch(console.error)
      .finally(() => {
        inflightRef.current = false;
        if (!cancelled) {
          setState((s) => ({ ...s, prefetching: false }));
        }
      });

    return () => {
      cancelled = true;
    };
  }, [initialLevel]);

  const getNextSentence = async () => {
    if (state.buffer.length === 0 && !inflightRef.current) {
      inflightRef.current = true;
      try {
        const data = await fetchShard(state.level, nextPageRef.current);
        nextPageRef.current++;
        setState((s) => ({ ...s, buffer: data }));
      } catch (err) {
        console.error(err);
      } finally {
        inflightRef.current = false;
      }
      return null; // UI může zobrazit spinner
    }
    const idx = Math.floor(Math.random() * state.buffer.length);
    const copy = [...state.buffer];
    const [picked] = copy.splice(idx, 1);
    setState((s) => ({ ...s, buffer: copy }));
    return picked;
  };

  return {
    buffer: state.buffer,
    prefetching: state.prefetching,
    setLevel: (lvl: Level) => setState((s) => ({ ...s, level: lvl })),
    getNextSentence,
  };
}
