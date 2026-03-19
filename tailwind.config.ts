import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#102027",
        mist: "#F6F4EF",
        sand: "#E9DFC7",
        moss: "#7A8C54",
        clay: "#C76B50",
        teal: "#0F766E"
      },
      boxShadow: {
        panel: "0 18px 45px rgba(16, 32, 39, 0.08)"
      },
      fontFamily: {
        sans: ["var(--font-sans)", "ui-sans-serif", "system-ui"]
      }
    }
  },
  plugins: []
};

export default config;
