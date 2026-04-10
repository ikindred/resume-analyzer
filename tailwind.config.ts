import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        navy: {
          800: "#1e3a5f",
          900: "#132238",
          950: "#0a1628",
        },
        accent: {
          DEFAULT: "#14b8a6",
          hover: "#0d9488",
        },
      },
    },
  },
  plugins: [],
};
export default config;
