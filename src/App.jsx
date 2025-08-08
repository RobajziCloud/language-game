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

  // ---- DnD helpers (native HTML5, no libs) ----
  const onDragStartWord = (e, source, payload) => {
    e.dataTransfer.setData("text/plain", JSON.stringify({ source, payload }));
    e.dataTransfer.effectAllowed = "move";
  };
  const allowDrop = (e) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; };

  const dropToBank = (e) => {
    e.preventDefault();
    const { source, payload } = JSON.parse(e.dataTransfer.getData("text/plain"));
    if (source === "bank") return; // already there
    if (source === "slot") {
      setSlots(prev => prev.filter((_,i)=> i !== payload.index));
      setBank(prev => [...prev, payload.word]);
      setChecked(false);
    }
  };

  const dropToSlotsEnd = (e) => {
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

  const dropBeforeIndex = (e, beforeIndex) => {
    e.preventDefault();
    const { source, payload } = JSON.parse(e.dataTransfer.getData("text/plain"));
    if (source === "bank") {
      setSlots(prev => {
        if (prev.includes(payload.word)) return prev;
        const next = [...prev];
        next.splice(beforeIndex, 0, payload.word);
        return next;
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
    <div className="min-h-screen px-5 py-8 transition-colors bg-gradient-to-b from-white to-zinc-50 text-zinc-900 dark:from-zinc-950 dark:to-black dark:text-zinc-100">
      <div className="mx-auto w-full max-w-4xl space-y-6">
        {/* Header */}
        <header className="flex items-center justify-between">
          <h1 className="text-3xl font-extrabold tracking-tight">🇫🇷 French Builder</h1>
          <button
            onClick={()=>setDark(d=>!d)}
            className="inline-flex items-center gap-2 rounded-full px-3 py-1.5 border border-zinc-300 dark:border-zinc-700 bg-white/70 dark:bg-zinc-900/70 backdrop-blur"
            aria-label="Toggle dark mode"
          >
            <span className="text-sm">Dark</span>
            <span className="h-5 w-10 rounded-full relative bg-zinc-300 dark:bg-zinc-700">
              <span className={"absolute top-0.5 h-4 w-4 rounded-full bg-white dark:bg-black transition "+(dark?"right-0.5":"left-0.5")}/>
            </span>
          </button>
        </header>

        <section className="grid gap-6 md:grid-cols-3">
          {/* Main card */}
          <div className="md:col-span-2 space-y-4">
            <div className="rounded-2xl p-6 shadow-md bg-white/70 dark:bg-zinc-900/70 backdrop-blur border border-zinc-200 dark:border-zinc-800">
              <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-2">Přetahuj slova a sestav větu:</p>

              {/* BANK */}
              <div
                id="BANK"
                className="min-h-[68px] rounded-2xl p-4 border border-zinc-200 dark:border-zinc-800 bg-white/80 dark:bg-zinc-900/60 backdrop-blur flex flex-wrap gap-2"
                onDragOver={allowDrop}
                onDrop={dropToBank}
              >
                {bank.length===0 && (
                  <div className="text-sm text-zinc-500">Žádná slova v zásobníku — přetáhni zpět ze věty.</div>
                )}
                {bank.map((w,i)=>(
                  <button
                    key={w}
                    draggable
                    onDragStart={(e)=>onDragStartWord(e,"bank",{ word:w })}
                    className="px-4 py-2 rounded-2xl text-sm font-medium shadow-sm border bg-white dark:bg-black border-zinc-200 dark:border-zinc-800 hover:shadow transition"
                  >
                    {w}
                  </button>
                ))}
              </div>

              {/* SLOTS */}
              <div
                id="SLOTS"
                className="mt-4 rounded-2xl p-4 border-2 border-dashed border-zinc-300 dark:border-zinc-700 bg-zinc-50/80 dark:bg-zinc-800/50 flex flex-wrap gap-2"
                onDragOver={allowDrop}
                onDrop={dropToSlotsEnd}
              >
                {slots.length===0 && (
                  <div className="text-sm text-zinc-500 self-center">Přetáhni sem slova ve správném pořadí…</div>
                )}
                {slots.map((w,i)=>(
                  <React.Fragment key={`${w}-${i}`}>
                    {/* drop-zone BEFORE chip i */}
                    <div
                      className="w-0.5 h-6 self-center bg-transparent"
                      onDragOver={allowDrop}
                      onDrop={(e)=>dropBeforeIndex(e,i)}
                    />
                    <div
                      draggable
                      onDragStart={(e)=>onDragStartWord(e,"slot",{ index:i, word:w })}
                      className={
                        "px-4 py-2 rounded-2xl text-sm font-semibold shadow-sm border transition cursor-grab active:cursor-grabbing "+
                        (checked ? (w===sentence.fr[i] ? "bg-emerald-300 text-emerald-900 border-emerald-400" : "bg-rose-300 text-rose-900 border-rose-400")
                                : "bg-zinc-200 dark:bg-zinc-700 border-zinc-300 dark:border-zinc-600")
                      }
                      title="Přetáhni pro změnu pořadí, nebo zpět do zásobníku"
                    >
                      {w}
                    </div>
                  </React.Fragment>
                ))}
              </div>

              {/* Controls */}
              <div className="mt-4 flex gap-3">
                {!checked ? (
                  <button
                    onClick={()=>setChecked(true)}
                    disabled={slots.length !== sentence.fr.length}
                    className={(slots.length===sentence.fr.length
                      ? "bg-emerald-500 text-white hover:brightness-110"
                      : "bg-zinc-300 text-zinc-600 cursor-not-allowed")+" px-5 py-2 rounded-xl font-semibold shadow transition"}
                  >
                    ✅ Ověřit
                  </button>
                ) : (
                  <button
                    onClick={next}
                    className="px-5 py-2 rounded-xl font-semibold shadow bg-indigo-500 text-white hover:brightness-110"
                  >
                    🔁 Další věta
                  </button>
                )}
              </div>

              {/* Result */}
              {checked && (
                <div className="mt-3">
                  <div className="text-sm text-zinc-600 dark:text-zinc-400">Správná věta:</div>
                  <div className="mt-1 italic text-lg">
                    {sentence.fr.map((w,i)=>(
                      <span key={i} title={sentence.pos?.[i]} className="underline decoration-dotted mr-2 cursor-help">
                        {w}
                      </span>
                    ))}
                  </div>
                  <div className={"mt-1 text-sm "+(isCorrect?"text-emerald-500":"text-rose-500")}>
                    {isCorrect ? "Skvělé! Vše správně 🎉" : "Některá slova jsou špatně — zkus další kolo."}
                  </div>
                  <div className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">{sentence.en}</div>
                </div>
              )}
            </div>
          </div>

          {/* Sidebar */}
          <aside className="rounded-2xl p-6 shadow-md bg-white/70 dark:bg-zinc-900/70 backdrop-blur border border-zinc-200 dark:border-zinc-800">
            <div className="text-sm text-zinc-500 dark:text-zinc-400 mb-2">Tipy</div>
            <ul className="text-sm list-disc pl-5 space-y-1 text-zinc-600 dark:text-zinc-400">
              <li>Přetahuj ze zásobníku do věty.</li>
              <li>Pořadí změníš přetažením mezi slovy.</li>
              <li>Vrácení zpět: přetáhni slovo do zásobníku.</li>
            </ul>
          </aside>
        </section>
      </div>
    </div>
  );
}
