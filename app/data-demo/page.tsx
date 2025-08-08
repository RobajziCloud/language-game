
"use client";
import React, { useEffect, useRef, useState } from "react";
import { LEVELS, type Sentence } from "@/app/hooks/useSentenceSource";
import { useSentenceSource } from "@/app/hooks/useSentenceSource";
export default function Page(){
  const [level, setLevel] = useState<typeof LEVELS[number]>("A2");
  const { buffer, prefetching, setLevel:applyLevel, getNextSentence } = useSentenceSource(level);
  const [current, setCurrent] = useState<Sentence | null>(null);
  useEffect(()=>{ applyLevel(level); }, [level, applyLevel]);
  return (
    <div className="min-h-screen p-6 text-white bg-gradient-to-b from-[#1a102f] via-[#2a174a] to-[#111428]">
      <h1 className="text-xl font-semibold mb-4">JSON shard loader demo</h1>
      <div className="flex items-center gap-3 mb-6">
        <label>Level:</label>
        <select value={level} onChange={(e)=>setLevel(e.target.value as any)} className="bg-white/10 rounded-lg px-3 py-2 ring-1 ring-white/15">
          {LEVELS.map(l=><option key={l}>{l}</option>)}
        </select>
        <button
  onClick={async () => {
    const s = await getNextSentence();
    setCurrent(s);
  }}
  className="bg-emerald-500 hover:bg-emerald-600 px-4 py-2 rounded-xl"
>
  Načti větu
</button>
        <span className="text-xs">Buffer: {buffer.length}</span>
        {prefetching && <span className="text-xs text-amber-300">Prefetch…</span>}
      </div>
      {current ? (
        <div className="space-y-2">
          <div className="text-lg">{current.english.join(" ")}</div>
          <div className="text-sm text-zinc-300">{current.explanation}</div>
          <div className="flex flex-wrap gap-2">{current.tokens.map(t=>(<span key={t.w} className="px-2 py-1 rounded-lg bg-white/10 ring-1 ring-white/10 text-xs">{t.w} <span className="opacity-60">({t.pos})</span></span>))}</div>
        </div>
      ) : <div className="text-zinc-400">Klikni na „Načti větu“.</div>}
      <p className="mt-8 text-sm text-zinc-400 border-t border-white/10 pt-4">Shardy v <code>/public/data/</code>, formát <code>sentences-LEVEL-PAGE.json</code>.</p>
    </div>
  );
}
