/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        tk: {
          bg: "#0a0a0a",
          surface: "#111111",
          surface2: "#1a1a1a",
          border: "#2a2a2a",
          "border-bright": "#3a3a3a",
          accent: "#00ff88",
          accent2: "#ff3366",
          accent3: "#ffcc00",
          info: "#4a90e2",
          text: "#e8e8e8",
          "text-dim": "#666666",
        },
      },
      fontFamily: {
        "tk-mono": ["Space Mono", "monospace"],
        "tk-display": ["DM Serif Display", "serif"],
      },
      borderRadius: {
        tk: "2px",
      },
      keyframes: {
        modalFadeIn: { from: { opacity: 0 }, to: { opacity: 1 } },
        modalScaleIn: {
          from: { opacity: 0, transform: "scale(0.95)" },
          to: { opacity: 1, transform: "scale(1)" },
        },
        toastSlideIn: {
          from: { opacity: 0, transform: "translateX(100%)" },
          to: { opacity: 1, transform: "translateX(0)" },
        },
      },
      animation: {
        "modal-fade-in": "modalFadeIn 0.2s ease-out",
        "modal-scale-in": "modalScaleIn 0.2s ease-out",
        "toast-slide-in": "toastSlideIn 0.3s ease-out",
      },
    },
  },
  plugins: [require("daisyui")],
  daisyui: {
    themes: ["dark"],
  },
};
