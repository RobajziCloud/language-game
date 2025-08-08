"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

export type Token = { w: string; pos: string; meaning: string };
export type Sentence = {
  id: string;
  english: string[];
  tokens: Token[];
  explanation: string;
};

export const LEVELS = ["A2", "B1", "B2"] as const;
export type Level = (typeof LEVELS)[number];

async function loadBatchFromPublic(level: Level, page: number): Promise<{ items: Sentence[]; eof: boolean }> {
  const url = `/data/sentences-${level}-${page}.json`;
  console.log("Loading sentences from:", url);
  try {
    const res = await fetch(url, { cache: "no-store" });
    console.log("Fetch status:", res.status);
    if (!res.ok) {
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

  const bufferRef = useRef<Sentence[]>(buffer);
  useEffect(() => { bufferRef.current = buffer; }, [buffer]);

  const pageRef = useRef<number>(1);
  const inflightRef = useRef(false);
  const eofRef = useRef(false);

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
      if (eofRef.current) {
        pageRef.current = 1;
        eofRef.current = false;
      }

      const { items, eof } = await loadBatchFromPublic(level, pageRef.current);

      if (eof) {
        eofRef.current = true;
        return [];
      }

      if (items.length) {
        pageRef.current += 1;
        setBuffer((prev) => [...prev, ...items]);
      }
      return items;
    } finally {
      setPrefetching(false);
      inflightRef.current = false;
    }
  }, [level]);

  useEffect(() => {
    const THRESHOLD = 1;
    if (buffer.length <= THRESHOLD && !prefetching) {
      prefetch();
    }
  }, [buffer.length, prefetching, prefetch]);

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
