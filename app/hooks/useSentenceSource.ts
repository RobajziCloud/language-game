"use client";
import { useEffect, useRef, useState } from "react";

export const LEVELS = ["A2","B1","B2"] as const;
export type Level = typeof LEVELS[number];

type Token = { w: string; pos: string; meaning: string };
export type Sentence = { id: string; level: string; topic: string; english: string[]; tokens: Token[]; explanation: string };

type SourceState = { level: Level; page: number; buffer: Sentence[]; prefetching: boolean };

async function fetchShard(level: string, page: number): Promise<Sentence[]> {
  const url = `/data/sentences-${level}-${page}.json`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`Nepodařilo se načíst ${url}`);
  return res.json();
}

export function useSentenceSource(initialLevel: Level) {
  const [state, setState] = useState<SourceState>({ level: initialLevel, page: 1, buffer: [], prefetching: false });
  const nextPageRef = useRef(2);

  useEffect(() => {
    setState({ level: initialLevel, page: 1, buffer: [], prefetching: false });
    nextPageRef.current = 2;
    fetchShard(initialLevel, 1).then((data) => setState((s) => ({ ...s, buffer: data }))).catch(console.error);
  }, [initialLevel]);

  useEffect(() => {
    if (state.prefetching) return;
    if (state.buffer.length < 3) {
      setState((s) => ({ ...s, prefetching: true }));
      const pageToGet = nextPageRef.current;
      fetchShard(state.level, pageToGet)
        .then((data) => setState((s) => ({ ...s, buffer: [...s.buffer, ...data], page: pageToGet })))
        .catch(() => {})
        .finally(() => setState((s) => ({ ...s, prefetching: false })));
      nextPageRef.current = pageToGet + 1;
    }
  }, [state.buffer.length, state.level, state.prefetching]);

  const getNextSentence = () => {
    if (state.buffer.length === 0) return null;
    const idx = Math.floor(Math.random() * state.buffer.length);
    const [picked] = state.buffer.splice(idx, 1);
    setState((s) => ({ ...s, buffer: [...state.buffer] }));
    return picked;
  };

  return { buffer: state.buffer, prefetching: state.prefetching, setLevel: (lvl: Level) => setState((s)=>({ ...s, level: lvl })), getNextSentence };
}