import React, { useMemo, useState } from 'react'

const SENTENCES = [
  { fr: ["Je", "suis", "étudiant"], en: "I am a student.", pos: ["pronoun","verb","noun"] },
  { fr: ["Elle", "mange", "une", "pomme"], en: "She is eating an apple.", pos: ["pronoun","verb","article","noun"] },
  { fr: ["Nous", "aimons", "la", "musique"], en: "We love music.", pos: ["pronoun","verb","article","noun"] },
]

function shuffle(arr) {
  return [...arr].map(v=>({v, r: Math.random()})).sort((a,b)=>a.r-b.r).map(o=>o.v)
}

export default function App(){
  const [dark, setDark] = useState(false)
  const [round, setRound] = useState(0)
  const [user, setUser] = useState([])
  const [checked, setChecked] = useState(false)
  const [score, setScore] = useState({correct:0, total:0})

  const sentence = SENTENCES[round % SENTENCES.length]
  const pool = useMemo(()=>shuffle(sentence.fr), [round])
  const done = checked && user.length === sentence.fr.length && user.every((w,i)=>w===sentence.fr[i])
  
  const toggleTheme = () => {
    setDark(d => !d)
    document.documentElement.classList.toggle('dark')
  }

  const pick = (w) => {
    if (checked) return
    if (user.includes(w)) return
    setUser(u => [...u, w])
  }
  const removeAt = (i) => {
    if (checked) return
    setUser(u => u.filter((_,idx)=>idx!==i))
  }
  const verify = () => {
    setChecked(true)
    const all = user.length === sentence.fr.length && user.every((w,i)=>w===sentence.fr[i])
    setScore(s => ({correct: s.correct + (all?1:0), total: s.total + 1}))
  }
  const next = () => {
    setChecked(false)
    setUser([])
    setRound(r=>r+1)
  }

  return (
    <div className="min-h-screen px-4 py-8 flex flex-col items-center gap-6 text-zinc-900 dark:text-zinc-100">
      <div className="w-full max-w-3xl flex items-center justify-between">
        <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">🇫🇷 French Microgame</h1>
        <div className="flex items-center gap-2">
          <span className="text-sm">Dark mode</span>
          <button onClick={toggleTheme} className="relative inline-flex h-6 w-11 items-center rounded-full bg-zinc-300 dark:bg-zinc-700 transition">
            <span className="inline-block h-5 w-5 transform rounded-full bg-white dark:bg-black translate-x-1 dark:translate-x-5 transition" />
          </button>
        </div>
      </div>

      <div className="w-full max-w-3xl grid gap-4 sm:grid-cols-3">
        <div className="sm:col-span-2">
          <div className="rounded-2xl p-6 shadow-md bg-white/70 dark:bg-zinc-900/70 backdrop-blur border border-zinc-200 dark:border-zinc-800">
            <p className="mb-3 text-sm text-zinc-600 dark:text-zinc-400">Tap the words to build the sentence in French:</p>
            <div className="flex flex-wrap gap-2 mb-4">
              {pool.map((w, i)=>(
                <button key={i} onClick={()=>pick(w)}
                  className={"animate-pop px-4 py-2 rounded-xl text-sm font-medium shadow hover:shadow-glow transition " + (user.includes(w) ? "opacity-40 cursor-not-allowed bg-zinc-300" : "bg-blue-500 text-white hover:brightness-110")}>
                  {w}
                </button>
              ))}
            </div>

            <div className="min-h-[64px] p-3 rounded-xl border border-dashed border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 flex flex-wrap gap-2">
              {user.map((w,i)=>(
                <div key={i} onClick={()=>removeAt(i)}
                  className={"px-4 py-2 rounded-xl text-sm font-semibold cursor-pointer transition " +
                    (checked ? (w===sentence.fr[i] ? "bg-green-400 text-green-950" : "bg-red-400 text-red-950") : "bg-zinc-200 dark:bg-zinc-700")}>
                  {w}
                </div>
              ))}
            </div>

            <div className="mt-4 flex gap-3">
              {!checked && (
                <button onClick={verify} disabled={user.length !== sentence.fr.length}
                  className={"px-5 py-2 rounded-xl font-semibold transition shadow " + (user.length===sentence.fr.length ? "bg-emerald-500 text-white hover:brightness-110" : "bg-zinc-300 text-zinc-600 cursor-not-allowed")}>
                  ✅ Verify
                </button>
              )}
              {checked && (
                <button onClick={next} className="px-5 py-2 rounded-xl font-semibold transition shadow bg-indigo-500 text-white hover:brightness-110">🔁 Next</button>
              )}
            </div>

            {checked && (
              <div className="mt-4">
                <div className="text-sm text-zinc-600 dark:text-zinc-400">Correct sentence:</div>
                <div className="mt-1 italic text-lg">
                  {sentence.fr.map((w,i)=>(
                    <span key={i} title={sentence.pos[i]} className="underline decoration-dotted mr-2 cursor-help">{w}</span>
                  ))}
                </div>
                <div className={"mt-2 text-sm " + (done ? "text-emerald-500" : "text-rose-500")}>
                  {done ? "Great job! Perfect order 🎉" : "Some words are misplaced. Try the next round!"}
                </div>
              </div>
            )}
          </div>
        </div>

        <aside className="rounded-2xl p-6 shadow-md bg-white/70 dark:bg-zinc-900/70 backdrop-blur border border-zinc-200 dark:border-zinc-800">
          <div className="text-sm text-zinc-500 dark:text-zinc-400 mb-3">Progress</div>
          <div className="space-y-2">
            <Row label="Rounds" value={score.total} />
            <Row label="Perfect" value={score.correct} />
            <Row label="Accuracy" value={score.total ? Math.round((score.correct/score.total)*100)+'%' : '—'} />
          </div>
        </aside>
      </div>

      <footer className="text-xs text-zinc-500 dark:text-zinc-400 pt-2">Click a selected word to remove it. Words show part of speech on hover.</footer>
    </div>
  )
}

function Row({label, value}){
  return (
    <div className="flex items-center justify-between text-sm">
      <span>{label}</span>
      <span className="font-semibold">{value}</span>
    </div>
  )
}
