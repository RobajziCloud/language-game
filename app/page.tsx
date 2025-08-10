"use client";
import React, { useEffect, useMemo, useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Check, X, Loader2, HelpCircle, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useSentenceSource, LEVELS, type Sentence } from "@/app/hooks/useSentenceSource";

type Verdict = "correct" | "wrong" | null;
type Token = { w: string; pos: string; meaning: string };
type Pack = { id: string; english: string[]; tokens: Token[]; explanation: string };

type Slot = { id: string; token: string | null };

function shuffle<T>(arr: T[]) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function Chip(state: Verdict) {
  return (
    <AnimatePresence>
      {state && (
        <motion.span
          key={state}
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0 }}
          className={
            "ml-2 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs " +
            (state === "correct"
              ? "bg-emerald-500/20 text-emerald-300 ring-1 ring-emerald-500/30"
              : "bg-rose-500/20 text-rose-300 ring-1 ring-rose-500/30")
          }
        >
          {state === "correct" ? <Check size={14} /> : <X size={14} />}
          {state === "correct" ? "OK" : "Špatně"}
        </motion.span>
      )}
    </AnimatePresence>
  );
}

export default function Page() {
  const [loading, setLoading] = useState(true);
  const [loadingStep, setLoadingStep] = useState(0);
  const [round, setRound] = useState(1);
  const [stats, setStats] = useState({ rounds: 0, correctTokens: 0, totalTokens: 0 });
  const [level, setLevel] = useState<"A2" | "B1" | "B2">("A2");
  const { buffer, prefetching, setLevel: applyLevel, getNextSentence } = useSentenceSource(level);
  const [pack, setPack] = useState<Pack | null>(null);
  const [pool, setPool] = useState<string[]>([]);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [verdict, setVerdict] = useState<Verdict[]>([]);
  const [showExplain, setShowExplain] = useState(false);
  const [transitioning, setTransitioning] = useState(false);

  // ⟳ LOOP fallback: vyber další větu z bufferu cirkulárně
  const pickNextFromBuffer = (currentId?: string | null): Sentence | null => {
    const arr = Array.isArray(buffer) ? buffer : [];
    if (!arr.length) return null;
    if (!currentId) return arr[0];
    const idx = arr.findIndex((s) => s.id === currentId);
    const nextIdx = idx >= 0 ? (idx + 1) % arr.length : 0;
    return arr[nextIdx] ?? null;
  };

  const sentenceToPack = (s: Sentence): Pack => ({
    id: s.id ?? String(Date.now()),
    english: s.english,
    tokens:
      Array.isArray(s.tokens) && s.tokens.length
        ? s.tokens
        : s.english.map((w) => ({ w, pos: "", meaning: "" })),
    explanation: s.explanation ?? "",
  });

  // Robust polling na další větu
  const waitForNextSentence = async (timeoutMs = 7000, intervalMs = 150) => {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      const s = await getNextSentence();
      if (s) return s;
      await new Promise((r) => setTimeout(r, intervalMs));
    }
    return null as Sentence | null;
  };

  // Loader progress
  useEffect(() => {
    const id = setInterval(() => setLoadingStep((s) => (s + 1) % 4), 700);
    const t = setTimeout(() => setLoading(false), 2600);
    return () => {
      clearInterval(id);
      clearTimeout(t);
    };
  }, []);

  // Reset při změně levelu – okamžitě vyprázdni UI
  useEffect(() => {
    applyLevel(level);
    setPack(null);
    setSlots([]);
    setPool([]);
    setVerdict([]);
    setShowExplain(false);
    setRound(1);
  }, [level, applyLevel]);

  // Inicializace první věty s pollingem + ⟳ LOOP fallback
  useEffect(() => {
    let cancelled = false;
    const init = async () => {
      if (pack) return;
      let s = await waitForNextSentence(7000, 150);
      if (!s) {
        // ⟳ LOOP fallback: když nepřijde věta, naber první z bufferu
        s = pickNextFromBuffer(null);
      }
      if (cancelled) return;
      if (s) {
        setPack(sentenceToPack(s));
      } else {
        console.warn("Nepodařilo se načíst první větu (ani z bufferu).");
      }
    };
    init();
    return () => {
      cancelled = true;
    };
  }, [pack, level, getNextSentence, buffer]);

  // ✅ Klíčový reset při změně věty (řeší uvízlé "I" v poolu)
  useEffect(() => {
    if (!pack) return;
    // plný reset podle nové věty
    const newSlots = pack.english.map((_, i) => ({ id: `s-${round}-${i}`, token: null }));
    setSlots(newSlots);
    setPool(shuffle(pack.english));
    setVerdict(Array(pack.english.length).fill(null));
    setShowExplain(false);
  }, [pack?.id, round]);

  const onDragStart = (word: string) => (e: React.DragEvent) => {
    e.dataTransfer.setData("text/plain", word);
    e.dataTransfer.effectAllowed = "move";
  };

  const getData = (e: React.DragEvent) => e.dataTransfer.getData("text/plain");

  const onDropToSlot = (slotIndex: number) => (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const word = getData(e);
    if (!word) return;

    let displaced: string | null = null;
    setSlots((prev) => {
      displaced = prev[slotIndex]?.token ?? null;
      const cleared = prev.map((sl) => (sl.token === word ? { ...sl, token: null } : sl));
      const next = [...cleared];
      next[slotIndex] = { ...next[slotIndex], token: word };
      return next;
    });
    setPool((p) => {
      const withoutDragged = p.filter((w) => w !== word);
      if (displaced && !withoutDragged.includes(displaced)) withoutDragged.push(displaced);
      return withoutDragged;
    });
    setVerdict((v) => v.map(() => null));
  };

  const onDropToPool = (e: React.DragEvent) => {
    e.preventDefault();
    const word = getData(e);
    if (!word) return;
    setSlots((prev) => prev.map((sl) => (sl.token === word ? { ...sl, token: null } : sl)));
    setPool((p) => (p.includes(word) ? p : [...p, word]));
    setVerdict((v) => v.map(() => null));
  };

  const onVerify = () => {
    if (!pack || transitioning) return;
    const chosen = slots.map((s) => s.token);
    const correct = pack.english;
    const res = chosen.map((t, i) => (t && t === correct[i] ? "correct" : "wrong")) as Verdict[];
    setVerdict(res);
    const correctCount = res.filter((r) => r === "correct").length;
    setStats((st) => ({
      rounds: st.rounds + 1,
      correctTokens: st.correctTokens + correctCount,
      totalTokens: st.totalTokens + correct.length,
    }));
    setShowExplain(true);
  };

  const canVerify = useMemo(() => slots.length > 0 && slots.every((s) => s.token !== null), [slots]);

  const onNextRound = async () => {
    if (transitioning) return;
    setTransitioning(true);

    setShowExplain(false);
    setVerdict([]);
    setSlots([]);
    setPool([]);

    // Nejprve zkusit zdroj (prefetch/fronta), pokud nic – ⟳ LOOP fallback z bufferu
    let s = await waitForNextSentence(7000, 150);
    if (!s) {
      s = pickNextFromBuffer(pack?.id ?? null);
    }

    if (!s) {
      console.warn("Nepodařilo se načíst další větu (ani z bufferu).");
      setTransitioning(false);
      return;
    }

    if (Array.isArray(s.english) && s.english.length > 0) {
      setPack(sentenceToPack(s)); // reset pool/slots se provede v useEffectu na pack.id
      setRound((r) => r + 1);
    } else {
      console.error("⚠️ Další věta neobsahuje validní english pole:", s);
    }

    setTimeout(() => setTransitioning(false), 0);
  };

  if (loading) {
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
            <div className="text-sm opacity-80 mb-2">{lines[loadingStep]}</div>
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
                disabled={transitioning}
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
                <div
                  key={`slots-${pack?.id ?? 'none'}-${round}`}
                  className="flex flex-wrap gap-3 p-4 rounded-2xl bg-white/5 ring-1 ring-white/10 min-h-[88px]"
                  onDragOver={(e) => e.preventDefault()}
                >
                  {slots.map((slot, idx) => (
                    <DropSlot
                      key={slot.id}
                      word={slot.token}
                      verdict={verdict[idx]}
                      onDrop={onDropToSlot(idx)}
                      onDragStartWord={onDragStart}
                    />
                  ))}
                </div>

                <div className="mt-6">
                  <div className="text-xs uppercase tracking-wider text-zinc-400 mb-2">Dostupná slova</div>
                  <div
                    className="flex flex-wrap gap-3 p-4 rounded-2xl bg-gradient-to-br from-white/5 to-white/0 ring-1 ring-white/10 min-h-[72px]"
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={onDropToPool}
                  >
                    <AnimatePresence>
                      {pool.map((w, idx) => (
                        <Word key={`${pack?.id}-${idx}`} word={w} draggable onDragStart={onDragStart(w)} />
                      ))}
                    </AnimatePresence>
                    {pool.length === 0 && (
                      <div className="text-xs text-zinc-500">
                        Všechna slova jsou umístěná. Přesuň je zpět sem, pokud chceš změnit pořadí.
                      </div>
                    )}
                  </div>
                </div>

                {!pack && (
                  <div className="mt-4 text-sm text-zinc-400">Načítám první větu…</div>
                )}

                <div className="mt-6 flex items-center justify-between">
                  <div className="text-xs text-zinc-400">
                    Tip: Slova můžeš libovolně přeskupovat přetažením mezi sloty a zásobníkem.
                  </div>
                  {!showExplain ? (
                    <Button disabled={!pack || !canVerify || transitioning} onClick={onVerify} className="gap-2">
                      Ověřit větu <ArrowRight size={16} />
                    </Button>
                  ) : (
                    <Button disabled={!pack || transitioning} onClick={onNextRound} className="gap-2">
                      {transitioning ? "Načítám…" : "Další kolo"} <ArrowRight size={16} />
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {showExplain && pack && !transitioning && (
            <div key={`explain-${pack.id}-${round}`} className="col-span-12 xl:col-span-4">
              <Card className="bg-white/5 border-white/10 backdrop-blur-xl">
                <CardHeader>
                  <CardTitle className="text-zinc-100 text-lg">Správná věta & slovník</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-zinc-400 mb-3">
                    Najetím myši zobrazíš slovní druh, kliknutím význam ze slovníku.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {pack.tokens.map((t, i) => (
                      <WordInfo key={`${pack.id}-${i}-${t.w}`} token={t} />
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

function Word({ word, draggable, onDragStart }: { word: string; draggable?: boolean; onDragStart?: (e: any) => void }) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      className="select-none cursor-grab active:cursor-grabbing px-3 py-2 rounded-xl bg-white/10 hover:bg-white/20 ring-1 ring-white/15 text-sm text-zinc-100 shadow"
      draggable={draggable}
      onDragStart={onDragStart}
    >
      {word}
    </motion.div>
  );
}

function DropSlot({
  word,
  verdict,
  onDrop,
  onDragStartWord,
}: {
  word: string | null;
  verdict: Verdict;
  onDrop: (e: React.DragEvent) => void;
  onDragStartWord: (w: string) => (e: React.DragEvent) => void;
}) {
  const [hover, setHover] = useState(false);
  return (
    <motion.div
      layout
      onDragOver={(e) => {
        e.preventDefault();
        setHover(true);
      }}
      onDragLeave={() => setHover(false)}
      onDrop={(e) => {
        setHover(false);
        e.stopPropagation();
        onDrop(e);
      }}
      className={`relative flex items-center justify-center h-12 rounded-2xl transition-all ring-1 ${
        hover ? "bg-emerald-400/10 ring-emerald-400/30" : "bg-white/5 ring-white/10"
      }`}
      style={{ minWidth: hover ? 120 : 84, padding: hover ? "0 12px" : "0 8px" }}
    >
      {word ? (
        <Word word={word} draggable onDragStart={onDragStartWord(word)} />
      ) : (
        <span className="text-xs text-zinc-500">Drop</span>
      )}
      <div className="absolute -bottom-2 left-1/2 -translate-x-1/2">{Chip(verdict)}</div>
    </motion.div>
  );
}

let WORDINFO_SEQ = 0;
function WordInfo({ token }: { token: Token }) {
  const [hover, setHover] = useState(false);
  const [open, setOpen] = useState(false);
  const myIdRef = useRef<number>(++WORDINFO_SEQ);
  const boxRef = useRef<HTMLDivElement | null>(null);

  // zavři při kliknutí mimo nebo když se otevře jiný tooltip
  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      const target = e.target as Node;
      if (boxRef.current && !boxRef.current.contains(target)) {
        setOpen(false);
      }
    };
    const onSomeoneOpened = (e: Event) => {
      const detail = (e as CustomEvent<number>).detail;
      if (detail !== myIdRef.current) setOpen(false);
    };
    document.addEventListener("click", onDocClick, true);
    window.addEventListener("wordinfo:open", onSomeoneOpened as EventListener);
    return () => {
      document.removeEventListener("click", onDocClick, true);
      window.removeEventListener("wordinfo:open", onSomeoneOpened as EventListener);
    };
  }, []);

  // když se otevřu, dám vědět ostatním, ať se zavřou
  useEffect(() => {
    if (open) {
      window.dispatchEvent(new CustomEvent<number>("wordinfo:open", { detail: myIdRef.current! }));
    }
  }, [open]);

  return (
    <div
      ref={boxRef}
      className="relative"
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      <button
        className="px-3 py-2 rounded-xl bg-white/10 hover:bg-white/20 ring-1 ring-white/15 text-sm text-zinc-100 shadow"
        onClick={() => setOpen((v) => !v)}
      >
        {token.w}
        <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded-full bg-white/10 text-zinc-300 ring-1 ring-white/10">
          {token.pos}
        </span>
      </button>
      <AnimatePresence>
        {!open && hover && (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 6 }}
            className="absolute left-1/2 -translate-x-1/2 top-full mt-2 z-10 px-2 py-1 rounded-md bg-zinc-900 text-zinc-100 text-xs ring-1 ring-zinc-700 whitespace-nowrap"
          >
            {token.pos}
          </motion.div>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 6 }}
            className="absolute left-0 top-full mt-2 z-20 p-3 rounded-2xl bg-zinc-900/95 ring-1 ring-zinc-700 text-sm"
            style={{ width: "250px" }}
          >
            <div className="text-emerald-300 text-xs mb-1">Význam</div>
            <div className="text-zinc-100">{token.meaning}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
