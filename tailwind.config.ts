import type { Config } from "tailwindcss";

/**
 * Configurația Tailwind CSS pentru RentA — Modern Storefront & E-Commerce Dashboard.
 *
 * Explicație pentru C/Java:
 * Păstrăm aceleași nume semantice de tokeni (`cream`, `ink`, `ochre`) ca o interfață
 * stabilă (similar cu o interfață Java `ThemePalette`), dar schimbăm implementarea
 * valorilor lor în stilul modern Storefront ("Corelystics Store"):
 * - cream: fundaluri luminoase Slate/White (#F8FAFC, #FFFFFF, #F1F5F9)
 * - ink: tipografie și contururi Slate (#0F172A, #64748B, #94A3B8)
 * - ochre: accentul principal Emerald Teal (#109E82, #0D856D, #E6F6F3)
 */
const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        cream: {
          DEFAULT: "#F8FAFC",
          light: "#FFFFFF",
          dark: "#F1F5F9",
        },
        ink: {
          DEFAULT: "#0F172A",
          muted: "#64748B",
          light: "#94A3B8",
        },
        ochre: {
          DEFAULT: "#109E82",
          hover: "#0D856D",
          light: "#E6F6F3",
        },
      },
      fontFamily: {
        display: ["var(--font-display)", "sans-serif"],
        mono: ["var(--font-mono)", "monospace"],
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
      },
      borderRadius: {
        none: "0px",
        sm: "6px",
        DEFAULT: "8px",
        md: "10px",
        lg: "12px",
        xl: "16px",
        "2xl": "20px",
        full: "9999px",
      },
      boxShadow: {
        card: "0 1px 3px 0 rgba(15, 23, 42, 0.04), 0 1px 2px -1px rgba(15, 23, 42, 0.04)",
        "card-hover":
          "0 10px 25px -5px rgba(15, 23, 42, 0.07), 0 8px 10px -6px rgba(15, 23, 42, 0.04)",
      },
    },
  },
  plugins: [],
};

export default config;
