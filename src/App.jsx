import React, { useState, useEffect } from "react";
import LoadingScreen from "./components/LoadingScreen";
import Logo from "./components/Logo";

function App() {
  const [loading, setLoading] = useState(true);
  const [started, setStarted] = useState(false); // nový stav

  useEffect(() => {
    const timeout = setTimeout(() => setLoading(false), 1800);
    return () => clearTimeout(timeout);
  }, []);

  if (loading) return <LoadingScreen />;

  if (!started) {
    return (
      <main className="text-white min-h-screen bg-black flex flex-col items-center justify-center gap-4">
        <Logo />
        <h1 className="text-3xl font-bold">Welcome to Lang Trainer</h1>
        <button
          className="bg-white text-black px-4 py-2 rounded hover:bg-gray-200 transition"
          onClick={() => setStarted(true)} // ← přidán handler
        >
          Start Learning
        </button>
      </main>
    );
  }

  // Zde se objeví další část aplikace (např. hra)
  return (
    <main className="text-white min-h-screen bg-black flex items-center justify-center">
      <h2 className="text-2xl">Hra nebo další obsah tady 🎉</h2>
    </main>
  );
}

export default App;
