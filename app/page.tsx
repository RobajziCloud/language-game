"use client";



import React, { useState, useEffect } from "react";

export default function Page() {
  const [loading, setLoading] = useState(true);
  const [sentences, setSentences] = useState([]);

  useEffect(() => {
    console.log("🔄 Začínám načítat data...");
    fetch("/sentences.json")
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
        return res.json();
      })
      .then((data) => {
        console.log("✅ Data načtena:", data);
        setSentences(data);
        setLoading(false);
      })
      .catch((err) => {
        console.error("❌ Chyba při načítání dat:", err);
        // I při chybě chceme vidět, jestli UI reaguje
        setSentences([]);
        setLoading(false);
      });
  }, []);

  if (loading) {
    return (
      <div style={{ color: "white", padding: "20px" }}>
        ⏳ Načítám data...
      </div>
    );
  }

  return (
    <div style={{ color: "white", padding: "20px" }}>
      <h1>🎯 Lang Trainer</h1>
      {sentences.length > 0 ? (
        <ul>
          {sentences.map((s, i) => (
            <li key={i}>{JSON.stringify(s)}</li>
          ))}
        </ul>
      ) : (
        <p>⚠️ Žádná data nenalezena</p>
      )}
    </div>
  );
}
