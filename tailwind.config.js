export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "ui-monospace", "SFMono-Regular", "monospace"],
      },
      colors: {
        ink: "#071014",
        panel: "#10181d",
        panel2: "#151f26",
        line: "#26333b",
        cyan: "#09c8f8",
        mint: "#2fe37b",
      },
    },
  },
  plugins: [],
};
