import type { Config } from "tailwindcss"

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        graphite: {
          950: "#090a0c",
          900: "#111318",
          850: "#171a21",
          800: "#1d222b",
          700: "#2a303b"
        },
        signal: {
          green: "#7bd88f",
          amber: "#f7c66f",
          red: "#ff8a8a",
          blue: "#8dc8ff"
        }
      },
      boxShadow: {
        panel: "0 18px 45px rgba(0, 0, 0, 0.28)"
      }
    }
  },
  plugins: []
}

export default config
