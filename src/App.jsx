import React, { useMemo, useState } from "react";
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { arrayMove, SortableContext, useSortable, rectSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { motion, AnimatePresence } from "framer-motion";
import clsx from "clsx";

const SENTENCES = [
  { fr: ["Je", "suis", "étudiant"], en: "I am a student.", pos: ["pronoun","verb","noun"] },
  { fr: ["Elle", "mange", "une", "pomme"], en: "She is eating an apple.", pos: ["pronoun","verb","article","noun"] },
  { fr: ["Nous", "aimons", "la", "musique"], en: "We love music.", pos: ["pronoun","verb","article","noun"] },
];

function shuffle(arr){ return [...arr].map(v=>({v,r:Math.random()})).sort((a,b)=>a.r-b.r).map(o=>o.v); }

function Chip({ children, className, ...rest }) {
  return (
    <motion.div
      layout
      whileTap={{ scale: 0.96 }}
      className={clsx(
        "px-4 py-2 rounded-2xl text-sm font-medium shadow-sm border",
        "bg-white/80 dark:bg-zinc-900/70 backdrop-blur",
        "border-zinc-200 dark:border-zinc-800",
        className
      )}
      {...rest}
    >
      {children}
    </motion.div>
  );
}

function SortableChip({ id, children, className }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };
  return (
    <Chip
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={clsx(
        "cursor-grab active:cursor-grabbing",
        isDragging && "shadow-lg",
        className
      )}
    >
      {children}
    </Chip>
  );
}

export default function App(){
  const [dark, setDark] = useState(false);
  const [round, setRound] = useState(0);
  const sentence = SENTENCES[round % SENTENCES.length];

  const [bank, setBank] = useState(() => shuffle(sentence.fr));
  const [slots, setSlots] = useState([]); // ordered chips user places
  const [checked, setChecked] = useState(false);

  // re-shuffle when round changes
  React.useEffect(() => {
    setBank(shuffle(sentence.fr));
    setSlots([]);
    setChecked(false);
  }, [round]);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 }}));

  const isCorrect = checked && slots.length === sentence.fr.length && slots.every((w,i)=>w===sentence.fr[i]);

  function onDragEnd(e) {
    const { active, over } = e;
    if (!over) return;

    // drag between BANK and SLOTS or re-order within SLOTS
    const activeId = active.id;
    const overId = over.id;

    const inSlotsOld = slots.indexOf(activeId);
    const inSlotsOver = slots.indexOf(overId);

    // 1) Reorder inside SLOTS
    if (inSlotsOld !== -1 && inSlotsOver !== -1 && inSlotsOld !== inSlotsOver) {
      setSlots(prev => arrayMove(prev, inSlotsOld, inSlotsOver));
      return;
    }

    // 2) Move from BANK -> SLOTS (drop over the SLOTS container placeholder)
    if (bank.includes(activeId) && overId === "SLOTS-AREA") {
      if (!slots.includes(activeId)) setSlots(prev => [...prev, activeId]);
      setBank(prev => prev.filter(w => w !== activeId));
      return;
    }

    // 3) Move from BANK -> specific chip (insert before it)
    if (bank.includes(activeId) && inSlotsOver !== -1) {
      setSlots(prev => {
        const idx = inSlotsOver;
        const next = [...prev];
        next.splice(idx, 0, activeId);
        return next;
      });
      setBank(prev => prev.filter(w => w !== activeId));
      return;
    }

    // 4) Dragging from SLOTS back into BANK (drop over BANK placeholder)
    if (inSlotsOld !== -1 && overId === "BANK-AREA") {
      setSlots(prev => prev.filter(w => w !== activeId));
      setBank(prev => [...prev, activeId]);
      return;
    }
  }

  function verify() { setChecked(true); }
  function next() { setRound(r=>r+1); }

  return (
    <div className={clsx("min-h-screen px-5 py-8 transition-colors",
      dark ? "bg-zinc-950 text-zinc-100" : "bg-gradient-to-b from-white to-zinc-50 text-zinc-900")}>
      <div className="mx-auto w-full max-w-4xl space-y-6">
        <header className="flex items-center justify-between">
          <h1 className="text-3xl font-extrabold tracking-tight">🇫🇷 French Builder</h1>
          <button
            onClick={()=>{ setDark(d=>!d); document.documentElement.classList.toggle("dark"); }}
            className="inline-flex items-center gap-2 rounded-full px-3 py-1.5 border border-zinc-300 dark:border-zinc-700 bg-white/70 dark:bg-zinc-900/70 backdrop-blur"
          >
            <span className="text-sm">Dark</span>
            <span className={clsx("h-5 w-10 rounded-full relative transition",
              "bg-zinc-300 dark:bg-zinc-700")}>
              <span className={clsx("absolute top-0.5 h-4 w-4 rounded-full bg-white dark:bg-black transition",
                dark ? "right-0.5" : "left-0.5")}/>
            </span>
          </button>
        </header>

        <section className="grid gap-6 md:grid-cols-3">
          <div className="md:col-span-2 space-y-4">
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              Drag words to build the correct French sentence:
            </p>

            {/* Word bank */}
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
              <SortableContext items={bank} strategy={rectSortingStrategy}>
                <div id="BANK-AREA"
                  className="min-h-[64px] rounded-2xl p-4 border border-zinc-200 dark:border-zinc-800 bg-white/70 dark:bg-zinc-900/70 backdrop-blur flex flex-wrap gap-2">
                  {bank.length === 0 && (
                    <div className="text-sm text-zinc-500 dark:text-zinc-500">No words here — drag back from the sentence to remove.</div>
                  )}
                  {bank.map((w) => (
                    <SortableChip key={w} id={w}>{w}</SortableChip>
                  ))}
                </div>
              </SortableContext>

              {/* Slots area */}
              <SortableContext items={slots} strategy={rectSortingStrategy}>
                <div
                  id="SLOTS-AREA"
                  className={clsx(
                    "mt-4 min-h-[80px] rounded-2xl p-4 border-2 border-dashed",
                    "border-zinc-300 dark:border-zinc-700 bg-zinc-50/80 dark:bg-zinc-800/50",
                    "flex flex-wrap gap-2"
                  )}
                >
                  <AnimatePresence initial={false}>
                    {slots.length === 0 && (
                      <motion.div
                        key="placeholder"
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        className="text-sm text-zinc-500 self-center"
                      >
                        Drop words here in order…
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {slots.map((w, i) => (
                    <SortableChip
                      key={w}
                      id={w}
                      className={clsx(
                        checked && (w === sentence.fr[i] ? "bg-emerald-300 text-emerald-900" : "bg-rose-300 text-rose-900")
                      )}
                    >
                      {w}
                    </SortableChip>
                  ))}
                </div>
              </SortableContext>

              {/* Controls */}
              <div className="mt-4 flex gap-3">
                {!checked ? (
                  <button
                    onClick={verify}
                    disabled={slots.length !== sentence.fr.length}
                    className={clsx(
                      "px-5 py-2 rounded-xl font-semibold shadow",
                      slots.length === sentence.fr.length
                        ? "bg-emerald-500 text-white hover:brightness-110"
                        : "bg-zinc-300 text-zinc-600 cursor-not-allowed"
                    )}
                  >
                    ✅ Verify
                  </button>
                ) : (
                  <button
                    onClick={next}
                    className="px-5 py-2 rounded-xl font-semibold shadow bg-indigo-500 text-white hover:brightness-110"
                  >
                    🔁 Next
                  </button>
                )}
              </div>

              {/* Result */}
              {checked && (
                <div className="mt-3">
                  <div className="text-sm text-zinc-600 dark:text-zinc-400">Correct sentence:</div>
                  <div className="mt-1 italic text-lg">
                    {sentence.fr.map((w,i)=>(
                      <span key={i} title={sentence.pos?.[i]} className="underline decoration-dotted mr-2 cursor-help">
                        {w}
                      </span>
                    ))}
                  </div>
                  <div className={clsx("mt-1 text-sm", isCorrect ? "text-emerald-500" : "text-rose-500")}>
                    {isCorrect ? "Great job! Perfect order 🎉" : "Some words are misplaced. Try the next round!"}
                  </div>
                </div>
              )}
            </DndContext>
          </div>

          {/* Sidebar / progress */}
          <aside className="rounded-2xl p-5 border border-zinc-200 dark:border-zinc-800 bg-white/70 dark:bg-zinc-900/70 backdrop-blur">
            <div className="text-sm text-zinc-500 dark:text-zinc-400 mb-2">Tips</div>
            <ul className="text-sm list-disc pl-5 space-y-1 text-zinc-600 dark:text-zinc-400">
              <li>Drag from the bank to the sentence area.</li>
              <li>Reorder by dragging within the sentence.</li>
              <li>Drag back to the bank to remove a word.</li>
            </ul>
          </aside>
        </section>
      </div>
    </div>
  );
}
