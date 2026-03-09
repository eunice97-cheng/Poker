import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        felt: {
          DEFAULT: '#1a6b3a',
          dark: '#0f4a28',
          light: '#2a8b52',
        },
        chip: {
          gold: '#d4af37',
          silver: '#c0c0c0',
        },
      },
      fontFamily: {
        poker: ['Georgia', 'serif'],
      },
    },
  },
  plugins: [],
}

export default config
