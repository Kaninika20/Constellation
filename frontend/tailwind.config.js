/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        campus: {
          50: '#eef6ff',
          100: '#d9eaff',
          200: '#bbdcff',
          300: '#8ac4ff',
          400: '#52a3ff',
          500: '#2b7fff', // Primary brand blue
          600: '#1561f5',
          700: '#0f4ce0',
          800: '#133db5',
          900: '#15368e',
          950: '#0d2157',
        },
        graph: {
          node: '#3b82f6',
          edge: '#94a3b8',
          fraud: '#ef4444',
          course: '#10b981',
          club: '#8b5cf6',
          event: '#f59e0b',
          interest: '#ec4899',
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
      }
    },
  },
  plugins: [],
}

