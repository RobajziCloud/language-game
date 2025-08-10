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
  | { items?: string[] }
  | { paths?: string[] };

/* ---------- Helpers ---------- */

function cryptoRandomId() {
  const c = (globalThis as any).crypto;
  if (c && typeof c.getRandomValues === "function") {
    const buf = new Uint32Array(2);
    c.getRandomValues(buf);
    return `${buf[0].toString(36)}${buf[1].toString(36)}`;
  }
  return Math.random().toString(36).slice(2);
}

/** Bezpečný parser jedné věty – vrátí validní Sentence nebo null. */
function parseSentence(raw: any): Sentence | null {
  console.log("[SRC] Raw sentence:", raw);
  if (!raw || typeof raw !== "object") return null;

  // 1) preferovaný tvar: { english: string[] }
  if (Array.isArray(raw.english)) {
    const english = raw.english.filter((x: any) => typeof x === "string");
    if (!english.length) return null;
    return {
      id: String(raw.id ?? cryptoRandomId()),
      english,
      tokens:
        Array.isArray(raw.tokens) && raw.tokens.length
          ? (raw.tokens as Token[])
          : english.map((w: string) => ({ w, pos: "", meaning: "" })),
      explanation: typeof raw.explanation === "string" ? raw.explanation : "",
    };
  }

  // 2) fallbacky: { en: string[] } | { english: "one two" } | { sentence: "..." }
  let english: string[] | null = null;
  if (Array.isArray((raw as any).en)) english = (raw as any).en.filter((x: any) => typeof x === "string");
  if (!english && typeof raw.english === "string") english = raw.english.trim().split(/\s+/);
  if (!english && typeof (raw as any).sentence === "string") english = (raw as any).sentence.trim().split(/\s+/);

  if (english && english.length) {
    return {
      id: String(raw.id ?? cryptoRandomId()),
      english,
      tokens:
        Array.isArray(raw.tokens) && raw.tokens.length
          ? (raw.tokens as Token[])
          : english.map((w: string) => ({ w, pos: "", meaning: "" })),
      explanation: typeof raw.explanation === "string" ? raw.explanation : "",
    };
  }

  return null;
}

/** Načte index pro daný level – preferuje /data/index-<LEVEL>.json (jak máš v deployi). */
async function fetchIndex(level: Level): Promise<string[]> {
  const candidates = [
    `/data/index-${level}.json`,     // tvoje umístění
    `/index-${level}.json`,          // fallback
    `/data/${level}/index.json`,     // fallback
  ];

  for (const url of candidates) {
    try {
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) {
        console.warn(`[SRC] Nelze načíst index ${url}:`, res.status, res.statusText);
        continue;
      }
      const data: IndexPayload = await res.json();
      console.log(`[SRC] Index OK ${url}:`, data);

      if (Array.isArray(data)) return data;
      if (data && typeof data === "object") {
        const files =
          (Array.isArray((data as any).files) && (data as any).files) ||
          (Array.isArray((data as any).items) && (data as any).items) ||
          (Array.isArray((data as any).paths) && (data as any).paths) ||
          [];
        if (files.length) return files;
      }
    } catch (e) {
      console.warn(`[SRC] Chyba při čtení indexu ${url}:`, e);
    }
  }

  console.error(`[SRC] Nepodařilo se najít žádný index pro level ${level}.`);
  return [];
}

/** Načte větu – zkusí více variant cesty podle tvaru položky v indexu. */
async function fetchSentence(path: string, level: Level): Promise<Sentence | null> {
  const p = String(path).trim();

  // Sestavíme kandidáty chytře (Set = žádné duplicity)
  const candidates = new Set<string>();

  const push = (u: string) => candidates.add(u.replace(/\/{2,}/g, "/"));

  // 1) přesně jak je v indexu (s/bez /, s/bez .json)
  push(p);
  if (!p.startsWith("/")) push(`/${p}`);
  if (!p.endsWith(".json")) {
    push(`${p}.json`);
    if (!p.startsWith("/")) push(`/${p}.json`);
  }

  // 2) pod /data
  const underData = p.startsWith("data/") || p.startsWith("/data/");
  if (!underData) {
    push(`/data/${p}`);
    if (!p.endsWith(".json")) push(`/data/${p}.json`);
  }

  // 3) pod /data/<level>/ – běžný tvar když index vrátí jen číslo nebo „A2-8“
  const bare = p.replace(/^\/+/, "").replace(/^data\//, "");
  push(`/data/${level}/${bare}`);
  if (!bare.endsWith(".json")) push(`/data/${level}/${bare}.json`);

  // 4) speciály:
  //    - jen číslo: "8" => /data/<level>/8.json
  if (/^\d+$/.test(bare)) {
    push(`/data/${level}/${bare}.json`);
  }
  //    - tvar "A2-8": zkusíme i /data/A2-8.json a /data/A2/8.json
  if (/^[A-Za-z]\d-\d+$/.test(bare)) {
    push(`/data/${bare}.json`);                // /data/A2-8.json
    const [, n]()
