"use client";
import React, { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Check, X, Loader2, HelpCircle, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useSentenceSource, LEVELS, type Sentence } from "@/app/hooks/useSentenceSource";

// --- Types ---
type Verdict = "correct" | "wrong" | null;
type Token = { w: string; pos: string; meaning: string };
type Pack = { id: string; english: string[]; tokens: Token[]; explanation: string };
type Slot = { id: string; token: string | null };

// --- Utils ---
function shuffle<T>(arr: T[]) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// --- Page ---
export default function Page() {
  // UI & progress
  const [loading, setLoading] = useState(true);
  const [booting, setBooting] = useState(true);
  const [round, setRound] = useState(1);
  const [stats, setStats] = useState({ rounds: 0, correctTokens: 0, totalTokens: 0 });

  // Level: default to A2 on first load
  const [level, setLevel] = useState<"A2" | "B1" | "B2">("A2");
  const { buffer, prefetching, setLevel: applyLevel, getNextSentence } = useSentenceSource(level);

  // Game state
  const [pack, setPack] = useState<Pack | null>(null);
  const [pool, setPool] = useState<string[]>([]);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [verdict, setVerdict] = useState<Verdict[]>([]);
  const [showExplain, setShowExplain] = useState(false);

  // --- Boot sequence: force A1 on first render and load first sentence ---
  useEffect(() => {
    let alive = true;
    async function boot() {
      // Always start on A1 when the page first mounts
      applyLevel("A2");
      setLevel("A2");
      setShowExplain(false);
      setPack(null);
      setSlots([]);
      setPool([]);
      setVerdict([]);

      // Wait for buffer to fill (or timeout)
      const start = Date.now();
      while (alive && buffer.length === 0 && Date.now() - start < 8000) {
        // tiny wait
        // eslint-disable-next-line no-await-in-loop
        await new Promise((r) => setTimeout(r, 100));
      }

      if (alive && buffer.length > 0) {
        const s = await getNextSentence();
        if (alive && s) primeFromSentence(s);
      }

      if (alive) {
        setBooting(false);
        setLoading(false);
      }
    }
    boot();
    return () => {
      alive = false;
    };
    // Intentionally do not include buffer in deps to avoid re-boot loops
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [applyLevel, getNextSentence]);

  // When user changes level via UI, reload first sentence of that level
  useEffect(() => {
    let alive = true;
    async function loadForLevel() {
      if (booting) return;
      applyLevel(level);
      setShowExplain(false);
      setPack(null);
      setSlots([]);
      setPool([]);
      setVerdict([]);

      // Wait briefly for new buffer
      const start = Date.now();
      while (alive && buffer.length === 0 && Date.now() - start < 4000) {
        // eslint-disable-next-line no-await-in-loop
        await new Promise((r) => setTimeout(r, 100));
      }
      const s = await getNextSentence();
      if (alive && s) primeFromSentence(s);
    }
    loadForLevel();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [level]);

  function primeFromSentence(s: Sentence) {
    const p: Pack = {
      id: s.id,
      english: s.english,
      tokens: s.tokens as Token[],
      explanation: s.explanation,
    };
    setPack(p);
    setSlots(p.english.map((_, i) => ({ id: `s-0-${i}`, token: null })));
    setPool(shuffle(p.english));
    setVerdict(Array(p.english.length).fill(null));
  }

  // --- Derived booleans ---
  const canVerify = useMemo(() => slots.length > 0 && slots.every((s) => s.token), [slots]);

  // --- Drag & drop handlers ---
  function onDragStart(word: string) {
    return (e: React.DragEvent<HTMLDivElement>) => {
      e.dataTransfer.setData("text/plain", word);
    };
  }

  function onDropToSlot(idx: number) {
    return (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      const w = e.dataTransfer.getData("text/plain");
      if (!w) return;
      // take from pool if present
      setPool((old) => old.filter((x) => x !== w));
      // if slot already filled -> return it to pool
      setSlots((old) => {
        const next = [...old];
        const prev = next[idx].token;
        next[idx] = { ...next[idx], token: w };
        if (prev) setPool((p) => [...p, prev]);
        return next;
      });
      setVerdict((v) => {
        const next = [...v];
        next[idx] = null;
        return next;
      });
    };
  }

  function onDropToPool(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    const w = e.dataTransfer.getData("text/plain");
    if (!w) return;
    // remove from whichever slot contains it
    setSlots((old) => old.map((s) => (s.token === w ? { ...s, token: null } : s)));
    setPool((old) => [...old, w]);
    setVerdict((v) => v.map(() => null));
  }

  // --- Verify and next round ---
  function onVerify() {
    if (!pack) return;
    const result = slots.map((s, i) => (s.token === pack.english[i] ? "correct" : "wrong")) as Verdict[];
    setVerdict(result);
    const correct = result.filter((r) => r === "correct").length;
    setStats((st) => ({
      rounds: st.rounds,
      correctTokens: st.correctTokens + correct,
      totalTokens: st.totalTokens + result.length,
    }));
    setShowExplain(true);
  }

  async function onNextRound() {
    const s = await getNextSentence();
    if (!s) return;
    primeFromSentence(s);
    setShowExplain(false);
    setRound((r) => r + 1);
    setStats((st) => ({ ...st, rounds: st.rounds + 1 }));
  }

  // --- Loading screen ---
  if (booting || loading || prefetching || !pack) {
    const lines = [
      "Načítám slovník…",
      "Připravuji hru…",
      "Nastavuji UI…",
      "Zakládám uživatele…",
    ];
    return (
      <div className="min-h-screen relative text-zinc-200 bg-gradient-to-b from-[#1a102f] via-[#0b0b13] to-[#111428]">
        <div
          className="pointer-events-none absolute inset-0 opacity-50"
          style={{
            background:
              "radial-gradient(600px 300px at 20% 10%, rgba(139,92,246,0.18), transparent), radial-gradient(500px 280px at 80% 20%, rgba(168,85,247,0.12), transparent)",
          }}
        />
        <div className="relative min-h-screen flex items-center justify-center">
          <div className="w-full max-w-md p-8 rounded-3xl backdrop-blur-xl bg-white/5 ring-1 ring-white/10 shadow-2xl">
            <div className="flex items-center gap-3 mb-6">
              <div className="h-10 w-10 rounded-2xl bg-emerald-400/10 grid place-items-center ring-1 ring-emerald-400/30">
                <Loader2 className="animate-spin" />
              </div>
              <div className="font-semibold tracking-wide text-lg">Lang Trainer</div>
            </div>
            <div className="text-sm opacity-80 mb-2">{lines[Math.min(3, 0)]}</div>
            <div className="w-full h-2 rounded-full bg-white/10 overflow-hidden">
              <motion.div
                className="h-full bg-emerald-400/80"
                initial={{ width: 0 }}
                animate={{ width: ["20%", "60%", "85%", "100%"] }}
                transition={{ duration: 2.6 }}
              />
            </div>
          </div>
        </div>
      </div>
    );
  }

  // --- Main UI ---
  return (
    <div className="min-h-screen relative text-zinc-200 bg-gradient-to-b from-[#1a102f] via-[#2a174a] to-[#111428]">
      <div
        className="pointer-events-none absolute inset-0 opacity-50"
        style={{
          background:
            "radial-gradient(700px 320px at 15% 10%, rgba(139,92,246,0.15), transparent), radial-gradient(560px 300px at 85% 15%, rgba(168,85,247,0.10), transparent)",
        }}
      />
      <div className="relative mx-auto max-w-6xl px-6 py-8">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-emerald-400/15 ring-1 ring-emerald-300/30 grid place-items-center">
              <span className="text-emerald-300 font-bold">LT</span>
            </div>
            <div>
              <h1 className="text-xl font-semibold tracking-wide">Lang Trainer</h1>
              <p className="text-xs text-zinc-400">Round #{round}</p>
            </div>
          </div>

          <div className="flex items-center gap-3 text-xs">
            <div className="px-3 py-2 rounded-xl bg-white/5 ring-1 ring-white/10">
              <div className="text-[10px] text-zinc-400 uppercase tracking-wider">Kola</div>
              <div className="text-sm text-zinc-100 font-medium">{stats.rounds}</div>
            </div>
            <div className="px-3 py-2 rounded-xl bg-white/5 ring-1 ring-white/10">
              <div className="text-[10px] text-zinc-400 uppercase tracking-wider">Úspěšnost</div>
              <div className="text-sm text-zinc-100 font-medium">
                {stats.totalTokens ? Math.round((stats.correctTokens / stats.totalTokens) * 100) + "%" : "–"}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <label className="text-[10px] text-zinc-400 uppercase tracking-wider">Level</label>
              <select
                value={level}
                onChange={(e) => setLevel(e.target.value as any)}
                className="bg-white/10 ring-1 ring-white/15 rounded-lg px-2 py-1 text-xs"
              >
                {LEVELS.map((l) => (
                  <option key={l} value={l}>
                    {l}
                  </option>
                ))}
              </select>
              {prefetching && <span className="text-[10px] text-amber-300">Načítám…</span>}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-12 gap-6">
          <div className="col-span-12 xl:col-span-8">
            <Card className="bg-white/5 border-white/10 backdrop-blur-xl">
              <CardHeader>
                <CardTitle className="text-zinc-100 text-lg">Build the sentence</CardTitle>
              </CardHeader>
              <CardContent>
                {/* Slots */}
                <div
                  className="flex flex-wrap gap-3 p-4 rounded-2xl bg-white/5 ring-1 ring-white/10 min-h-[88px]"
                  onDragOver={(e) => e.preventDefault()}
                >
                  {slots.map((slot, idx) => (
                    <DropSlot key={slot.id} word={slot.token} verdict={verdict[idx]} onDrop={onDropToSlot(idx)} />
                  ))}
                </div>

                {/* Pool */}
                <div className="mt-6">
                  <div className="text-xs uppercase tracking-wider text-zinc-400 mb-2">Dostupná slova</div>
                  <div
                    className="flex flex-wrap gap-3 p-4 rounded-2xl bg-gradient-to-br from-white/5 to-white/0 ring-1 ring-white/10 min-h-[72px]"
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={onDropToPool}
                  >
                    <AnimatePresence>
                      {pool.map((w) => (
                        <Word key={w} word={w} draggable onDragStart={onDragStart(w)} />
                      ))}
                    </AnimatePresence>
                    {pool.length === 0 && (
                      <div className="text-xs text-zinc-500">
                        Všechna slova jsou umístěná. Přesuň je zpět sem, pokud chceš změnit pořadí.
                      </div>
                    )}
                  </div>
                </div>

                {/* Controls */}
                <div className="mt-6 flex items-center justify-between">
                  <div className="text-xs text-zinc-400">
                    Tip: Slova můžeš libovolně přeskupovat přetažením mezi sloty a zásobníkem.
                  </div>
                  {!showExplain ? (
                    <Button disabled={!canVerify} onClick={onVerify} className="gap-2">
                      Ověřit větu <ArrowRight size={16} />
                    </Button>
                  ) : (
                    <Button onClick={onNextRound} className="gap-2">
                      Další kolo <ArrowRight size={16} />
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Explain & dictionary */}
          {showExplain && pack && (
            <div className="col-span-12 xl:col-span-4">
              <Card className="bg-white/5 border-white/10 backdrop-blur-xl">
                <CardHeader>
                  <CardTitle className="text-zinc-100 text-lg">Správná věta & slovník</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-zinc-400 mb-3">
                    Najetím myši zobrazíš slovní druh, kliknutím význam ze slovníku.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {pack.tokens.map((t) => (
                      <WordInfo key={t.w} token={t} />
                    ))}
                  </div>
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mt-6 p-4 rounded-2xl bg-amber-400/10 ring-1 ring-amber-300/20 text-amber-200 text-sm"
                  >
                    <div className="flex items-start gap-2">
                      <HelpCircle size={18} className="mt-0.5" />
                      <div>
                        <div className="font-medium mb-1">Vysvětlení</div>
                        <div className="opacity-90">{pack.explanation}</div>
                      </div>
                    </div>
                  </motion.div>
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// --- Small UI pieces ---
function Word({ word, draggable, onDragStart }: { word: string; draggable?: boolean; onDragStart?: (e: any) => void }) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -6 }}
      className="px-3 py-1.5 rounded-xl bg-white/10 ring-1 ring-white/15 text-sm cursor-grab"
      draggable={draggable}
      onDragStart={onDragStart}
    >
      {word}
    </motion.div>
  );
}

function DropSlot({ word, verdict, onDrop }: { word: string | null; verdict: Verdict | null; onDrop: (e: React.DragEvent<HTMLDivElement>) => void }) {
  return (
    <div
      onDrop={onDrop}
      onDragOver={(e) => e.preventDefault()}
      className="h-10 px-3 rounded-xl grid place-items-center bg-white/5 ring-1 ring-white/10 min-w-[88px]"
    >
      <div className="flex items-center">
        <span className="text-sm text-zinc-100 min-w-[60px] text-center opacity-90">{word ?? "–––"}</span>
        {verdict && <Chip state={verdict} />}
      </div>
    </div>
  );
}

function WordInfo({ token }: { token: Token }) {
  return (
    <div className="px-2 py-1 rounded-lg bg-white/5 ring-1 ring-white/10 text-xs text-zinc-200" title={`${token.pos} — ${token.meaning}`}>
      {token.w}
    </div>
  );
}
