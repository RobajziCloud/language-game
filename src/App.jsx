import React, { useMemo, useState, useEffect } from "react";



const SENTENCES = [
  { fr: ["Je", "suis", "étudiant"], en: "I am a student.", pos:["pronoun","verb","noun"] },
  { fr: ["Elle", "mange", "une", "pomme"], en: "She is eating an apple.", pos:["pronoun","verb","article","noun"] },
  { fr: ["Nous", "aimons", "la", "musique"], en: "We love music.", pos:["pronoun","verb","article","noun"] },
];

function shuffle(arr){ return [...arr].map(v=>({v, r:Math.random()})).sort((a,b)=>a.r-b.r).map(o=>o.v); }

export default function App(){
  const [dark, setDark] = useState(false);
  const [round, setRound] = useState(0);
  const sentence = SENTENCES[round % SENTENCES.length];

  const [bank, setBank] = useState(()=>shuffle(sentence.fr));
  const [slots, setSlots] = useState([]);
  const [checked, setChecked] = useState(false);

  useEffect(()=>{ document.documentElement.classList.toggle("dark", dark); },[dark]);
  useEffect(()=>{
    setBank(shuffle(sentence.fr));
    setSlots([]);
    setChecked(false);
  },[round]);

  const isCorrect = checked && slots.length===sentence.fr.length && slots.every((w,i)=>w===sentence.fr[i]);

  // --- Native DnD ---
  const onDragStart = (e, source, payload) => {
    e.dataTransfer.setData("text/plain", JSON.stringify({ source, payload }));
    e.dataTransfer.effectAllowed = "move";
  };
  const allowDrop = (e) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; };

  const dropBank = (e) => {
    e.preventDefault();
    const { source, payload } = JSON.parse(e.dataTransfer.getData("text/plain"));
    if (source === "slot") {
      setSlots(prev => prev.filter((_,i)=> i !== payload.index));
      setBank(prev => [...prev, payload.word]);
      setChecked(false);
    }
  };

  const dropSlotsEnd = (e) => {
    e.preventDefault();
    const { source, payload } = JSON.parse(e.dataTransfer.getData("text/plain"));
    if (source === "bank") {
      if (!slots.includes(payload.word)) setSlots(prev => [...prev, payload.word]);
      setBank(prev => prev.filter(w => w !== payload.word));
    } else if (source === "slot") {
      setSlots(prev => {
        const next = [...prev];
        const w = next.splice(payload.index,1)[0];
        next.push(w);
        return next;
      });
    }
    setChecked(false);
  };

  const dropBefore = (e, beforeIndex) => {
    e.preventDefault();
    const { source, payload } = JSON.parse(e.dataTransfer.getData("text/plain"));
    if (source === "bank") {
      setSlots(prev => {
        if (prev.includes(payload.word)) return prev;
        const next = [...prev]; next.splice(beforeIndex, 0, payload.word); return next;
      });
      setBank(prev => prev.filter(w => w !== payload.word));
    } else if (source === "slot") {
      setSlots(prev => {
        const next = [...prev];
        const [w] = next.splice(payload.index,1);
        const insertAt = payload.index < beforeIndex ? beforeIndex - 1 : beforeIndex;
        next.splice(insertAt, 0, w);
        return next;
      });
    }
    setChecked(false);
  };

  const verify = ()=> setChecked(true);
  const next = ()=> setRound(r=>r+1);

  return (
    <div className="min-h-screen bg-brand-radial bg-no-repeat">
      {/* Top bar */}
      <div className="px-6 pt-6">
        <div className="mx-auto max-w-6xl rounded-2xl border border-zinc-200/60 dark:border-zinc-800/60 bg-white/70 dark:bg-zinc-900/60 backdrop-blur shadow-soft">
          <div className="flex items-center justify-between px-6 py-4">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-xl bg-brand-500/10 flex items-center justify-center">
                <span className="text-brand-600 text-lg">ƒ</span>
              </div>
              <h1 className="text-lg sm:text-xl font-extrabold tracking-tight text-zinc-900 dark:text-zinc-100">
                French Builder
              </h1>
            </div>
            <button
              onClick={()=>setDark(d=>!d)}
              className="inline-flex items-center gap-2 rounded-full px-3 py-1.5 border border-zinc-200 dark:border-zinc-700 bg-white/70 dark:bg-zinc-900/70"
              aria-label="Toggle dark mode"
            >
              <span className="hidden sm:inline text-sm text-zinc-600 dark:text-zinc-300">Dark</span>
              <span className="h-5 w-10 rounded-full relative bg-zinc-300 dark:bg-zinc-700">
                <span className={"absolute top-0.5 h-4 w-4 rounded-full bg-white dark:bg-black transition-smooth "+(dark?"right-0.5":"left-0.5")}/>
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="px-6 pb-10 pt-6">
        <div className="mx-auto max-w-6xl grid gap-6 md:grid-cols-3">
          {/* Main card */}
          <div className="md:col-span-2 rounded-2xl border border-zinc-200/60 dark:border-zinc-800/60 bg-white/70 dark:bg-zinc-900/60 backdrop-blur shadow-soft p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <div className="text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Exercise</div>
                <div className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">Build the sentence</div>
              </div>
              <div className="text-sm text-zinc-500 dark:text-zinc-400">
                Round <span className="font-semibold text-zinc-700 dark:text-zinc-200">{(round % SENTENCES.length)+1}</span> / {SENTENCES.length}
              </div>
            </div>

            {/* BANK */}
            <div
              className="min-h-[72px] rounded-2xl p-4 border border-zinc-200 dark:border-zinc-800 bg-white/80 dark:bg-zinc-900/60 flex flex-wrap gap-2"
              onDragOver={(e)=>e.preventDefault()}
              onDrop={dropBank}
            >
              {bank.length===0 ? (
                <div className="text-sm text-zinc-500">No words in bank — drag back from the sentence.</div>
              ) : bank.map((w)=>(
                <button
                  key={w}
                  draggable
                  onDragStart={(e)=>onDragStart(e,"bank",{ word:w })}
                  className="px-4 py-2 rounded-xl text-sm font-medium border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-black shadow-sm hover:shadow-soft transition-smooth hover:shadow-glow active:scale-[.98]"
                >
                  {w}
                </button>
              ))}
            </div>

            {/* SLOTS */}
            <div
              className="mt-4 rounded-2xl p-4 border-2 border-dashed border-zinc-300 dark:border-zinc-700 bg-zinc-50/80 dark:bg-zinc-800/50 flex flex-wrap gap-2"
              onDragOver={allowDrop}
              onDrop={dropSlotsEnd}
            >
              {slots.length===0 && (
                <div className="text-sm text-zinc-500 self-center">Drag words here in order…</div>
              )}
              {slots.map((w,i)=>(
                <React.Fragment key={`${w}-${i}`}>
                  {/* drop slot before */}
                  <div
                    className="w-0.5 h-6 self-center bg-transparent"
                    onDragOver={allowDrop}
                    onDrop={(e)=>dropBefore(e,i)}
                  />
                  <div
                    draggable
                    onDragStart={(e)=>onDragStart(e,"slot",{ index:i, word:w })}
                    className={
                      "px-4 py-2 rounded-xl text-sm font-semibold border shadow-sm transition-smooth cursor-grab active:cursor-grabbing "+
                      (checked
                        ? (w===sentence.fr[i]
                            ? "bg-emerald-300 text-emerald-950 border-emerald-400"
                            : "bg-rose-300 text-rose-950 border-rose-400")
                        : "bg-zinc-200/80 dark:bg-zinc-700/80 border-zinc-300 dark:border-zinc-600")
                    }
                    title="Drag to reorder or back to bank"
                  >
                    {w}
                  </div>
                </React.Fragment>
              ))}
            </div>

            {/* Controls */}
            <div className="mt-5 flex items-center gap-3">
              {!checked ? (
                <button
                  onClick={verify}
                  disabled={slots.length !== sentence.fr.length}
                  className={
                    "px-5 py-2.5 rounded-xl font-semibold shadow-sm transition-smooth "+
                    (slots.length===sentence.fr.length
                      ? "bg-brand-600 text-white hover:brightness-110"
                      : "bg-zinc-300 text-zinc-600 cursor-not-allowed")
                  }
                >
                  ✅ Verify
                </button>
              ) : (
                <button
                  onClick={()=>setRound(r=>r+1)}
                  className="px-5 py-2.5 rounded-xl font-semibold shadow-sm transition-smooth bg-brand-500 text-white hover:brightness-110"
                >
                  🔁 Next
                </button>
              )}
              {checked && (
                <div className={"text-sm "+(isCorrect?"text-emerald-500":"text-rose-500")}>
                  {isCorrect ? "Great job! Perfect order 🎉" : "Some words are misplaced — try the next round."}
                </div>
              )}
            </div>

            {/* Result */}
            {checked && (
              <div className="mt-4">
                <div className="text-sm text-zinc-600 dark:text-zinc-400">Correct sentence:</div>
                <div className="mt-1 italic text-lg">
                  {sentence.fr.map((w,i)=>(
                    <span key={i} title={sentence.pos?.[i]} className="underline decoration-dotted mr-2 cursor-help">
                      {w}
                    </span>
                  ))}
                </div>
                <div className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">{sentence.en}</div>
              </div>
            )}
          </div>

          {/* Side card (metrics / tips) */}
          <aside className="rounded-2xl border border-zinc-200/60 dark:border-zinc-800/60 bg-white/70 dark:bg-zinc-900/60 backdrop-blur shadow-soft p-6">
            <div className="text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400 mb-2">Tips</div>
            <ul className="text-sm list-disc pl-5 space-y-1 text-zinc-600 dark:text-zinc-400">
              <li>Drag from the bank into the sentence area.</li>
              <li>Reorder by dragging between words.</li>
              <li>Drag a word back to the bank to remove it.</li>
            </ul>
          </aside>
        </div>
      </div>
    </div>
  );
}
