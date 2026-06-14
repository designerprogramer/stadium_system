export default {
  content: [
    "./index.html",
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        stadium: {
          50: "#f6f8fb",
          100: "#e9eef5",
          500: "#0ea5e9",
          600: "#0284c7",
          900: "#0f172a",
        },
        pitch: {
          500: "#16a34a",
          600: "#15803d",
        },
        ember: {
          500: "#f97316",
          600: "#ea580c",
        },
      },
      boxShadow: {
        glow: "0 24px 80px rgba(14, 165, 233, 0.22)",
      },
    },
  },
  plugins: [],
};
