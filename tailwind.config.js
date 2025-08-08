/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      boxShadow: {
        glow: "0 0 0 3px rgba(59,130,246,0.25)",
      },
      keyframes: {
        pop: { "0%": { transform: "scale(0.9)", opacity: "0.6" }, "100%": { transform: "scale(1)", opacity: "1" } },
      },
      animation: {
        pop: "pop 120ms ease-out",
      }
    },
  },
  plugins: [],
}
