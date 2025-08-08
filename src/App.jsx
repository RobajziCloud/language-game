import React, { useState, useEffect } from "react";
import LoadingScreen from "./components/LoadingScreen";
import Logo from "./components/Logo";
import Game from "./components/Game";

function App() {
  const [loading, setLoading] = useState(true);
  const [started, setStarted] = useState(false);

  useEffect(() => {
    const timeout = setTimeout(() => setLoading(false), 1500);
    return () => clearTimeout(timeout);
  }, []);

  if (loading) return <LoadingScreen />;
  if (started) return <Game />;

  return (
    <main className="text-white min-h-screen bg-black flex flex-col items-center justify-center gap-4">
      <Logo />
      <h1 className="text-3xl font-bold">Welcome to Lang Trainer</h1>
      <button
        onClick={() => setStarted(true)}
        className="bg-white text-black px-4 py-2 rounded hover:bg-gray-200 transition"
      >
        Start Learning
      </button>
    </main>
  );
}

export default App;