import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        primary: '#f59e0b',
        'primary-dark': '#d97706',
        surface: '#111827',
        danger: '#ef4444',
        success: '#22c55e',
      },
    },
  },
  plugins: [],
}

export default config
