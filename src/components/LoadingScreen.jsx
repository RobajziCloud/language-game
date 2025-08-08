import React from "react";

export default function LoadingScreen() {
  return (
    <div className="flex items-center justify-center h-screen bg-black text-white flex-col gap-4">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-400"></div>
      <p className="text-lg">Loading...</p>
    </div>
  );
}