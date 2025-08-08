import { useEffect, useState } from "react";
import LoadingScreen from "./components/LoadingScreen";
import Logo from "./components/Logo";
import sentences from "../public/sentences.json";

export default function App() {
  const [gameStarted, setGameStarted] = useState(false);
  const [currentSentenceIndex, setCurrentSentenceIndex] = useState(0);
  const [shuffledWords, setShuffledWords] = useState([]);
  const [userSentence, setUserSentence] = useState([]);
  const [feedback, setFeedback] = useState(null);
  const [animateOut, setAnimateOut] = useState(false);

  const sentenceData = sentences[currentSentenceIndex];
  const correctWords = sentenceData.sentence.split(" ");

  useEffect(() => {
    const shuffled = [...correctWords].sort(() => Math.random() - 0.5);
    setShuffledWords(shuffled);
    setUserSentence([]);
    setFeedback(null);
  }, [currentSentenceIndex]);

  function handleWordClick(word) {
    setUserSentence([...userSentence, word]);
    setShuffledWords(shuffledWords.filter((w) => w !== word));
  }

  function handleRemoveWord(index) {
    const wordToReturn = userSentence[index];
    setUserSentence(userSentence.filter((_, i) => i !== index));
    setShuffledWords([...shuffledWords, wordToReturn]);
  }

  function checkSentence() {
    const isCorrect = userSentence.join(" ") === correctWords.join(" ");
    setFeedback({
      correct: isCorrect,
      correctSentence: correctWords.join(" "),
    });
    localStorage.setItem("lastScore", isCorrect ? "correct" : "wrong");
  }

  function nextRound() {
    setAnimateOut(true);
    setTimeout(() => {
      setAnimateOut(false);
      setCurrentSentenceIndex(
        (prevIndex) => (prevIndex + 1) % sentences.length
      );
    }, 600);
  }

  if (!gameStarted)
    return <LoadingScreen onStart={() => setGameStarted(true)} />;

  return (
    <div className="min-h-screen bg-gradient-to-br from-zinc-900 via-zinc-950 to-black text-white p-8">
      <div className="flex justify-between items-center mb-6">
        <Logo />
        <button
          onClick={checkSentence}
          className="bg-white/10 hover:bg-white/20 text-sm px-4 py-2 rounded-full backdrop-blur-md transition"
        >
          Ověřit větu
        </button>
      </div>

      <div
        className={`transition-all duration-500 ${
          animateOut ? "opacity-0 translate-y-10" : "opacity-100"
        }`}
      >
        <h2 className="text-2xl font-semibold mb-4">
          Sestav správnou větu z těchto slov:
        </h2>

        <div className="flex flex-wrap gap-2 mb-6">
          {shuffledWords.map((word, i) => (
            <button
              key={i}
              onClick={() => handleWordClick(word)}
              className="bg-white/5 hover:bg-white/10 px-4 py-2 rounded-xl shadow backdrop-blur-sm transition"
            >
              {word}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap gap-2 min-h-[64px] bg-white/5 rounded-xl p-4 mb-4 backdrop-blur">
          {userSentence.map((word, i) => (
            <div
              key={i}
              onClick={() => handleRemoveWord(i)}
              className="bg-white/10 px-4 py-2 rounded-xl cursor-pointer hover:bg-white/20 transition"
            >
              {word}
            </div>
          ))}
        </div>

        {feedback && (
          <div
            className={`mt-4 p-4 rounded-xl backdrop-blur ${
              feedback.correct
                ? "bg-green-500/10 text-green-400"
                : "bg-red-500/10 text-red-400"
            }`}
          >
            {feedback.correct ? (
              <p>✅ Správně!</p>
            ) : (
              <>
                <p>❌ Nesprávně.</p>
                <p>
                  Správná věta:{" "}
                  <span className="italic">{feedback.correctSentence}</span>
                </p>
              </>
            )}
            <button
              onClick={nextRound}
              className="mt-4 bg-white/10 hover:bg-white/20 px-4 py-2 rounded-full transition"
            >
              Hrát další kolo
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
