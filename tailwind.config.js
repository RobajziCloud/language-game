/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "Segoe UI", "Roboto", "Arial", "sans-serif"],
      },
      colors: {
        brand: {
          50:  "#f5f6ff",
          100: "#eceeff",
          200: "#d9dcff",
          300: "#b7bbff",
          400: "#8f94ff",
          500: "#6b6bff", // hlavní akcent (indigo/lila)
          600: "#5650f0",
          700: "#4a43d0",
          800: "#3a35a6",
          900: "#2e2a82",
        },
      },
      borderRadius: {
        xl: "1.25rem",      // hlavní radius pro karty/chipy
        "2xl": "1.5rem",
      },
      boxShadow: {
        soft: "0 10px 30px rgba(20, 20, 43, 0.06)",
        glow: "0 0 0 6px rgba(107, 107, 255, 0.15)",
      },
      backgroundImage: {
        "brand-radial":
          "radial-gradient(1200px 600px at 80% -10%, rgba(107,107,255,.20), rgba(107,107,255,0) 60%), radial-gradient(1000px 500px at 10% 110%, rgba(58,53,166,.20), rgba(58,53,166,0) 55%)",
      },
      transitionTimingFunction: {
        smooth: "cubic-bezier(.2,.8,.2,1)",
      },
    },
  },
  plugins: [],
};
