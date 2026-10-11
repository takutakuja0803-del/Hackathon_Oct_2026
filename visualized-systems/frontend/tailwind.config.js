/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        canvas: '#f5f7fb',
        surface: 'rgba(255, 255, 255, 0.85)',
        'surface-solid': '#ffffff',
        'surface-card': '#ffffff',
        'surface-subtle': '#f0f3f8',
        'surface-highlight': '#e8eff8',
        'text-primary': '#17181a',
        'text-secondary': '#62666d',
        'text-muted': '#717680',
        'text-dim': '#8e939d',
        accent: {
          DEFAULT: '#0066cc',
          hover: '#0056ad',
          subtle: 'rgba(0, 102, 204, 0.08)',
          glow: 'rgba(0, 102, 204, 0.25)',
        },
        memory: {
          box: '#ffffff',
          boxBorder: 'rgba(20, 24, 30, 0.14)',
          boxHover: 'rgba(0, 102, 204, 0.25)',
          stackBg: '#ffffff',
          heapBg: '#f8fafc',
          pointer: '#0066cc',
          dangling: '#e11d48',
          alias: '#0284c7',
          mutated: '#10b981',
          expired: '#f43f5e',
        },
        border: {
          subtle: 'rgba(20, 24, 30, 0.12)',
          strong: 'rgba(20, 24, 30, 0.22)',
          focus: '#0066cc',
        },
      },
      borderRadius: {
        card: '24px',
        cardLg: '26px',
        box: '18px',
      },
      boxShadow: {
        soft: '0 18px 50px rgba(21, 35, 55, 0.08)',
        card: '0 8px 24px rgba(21, 35, 55, 0.06)',
        box: '0 4px 14px rgba(21, 35, 55, 0.07)',
        boxHover: '0 8px 26px rgba(0, 102, 204, 0.14)',
        float: '0 20px 45px rgba(21, 35, 55, 0.14)',
      },
      fontFamily: {
        sans: ['-apple-system', 'BlinkMacSystemFont', '"SF Pro Display"', '"SF Pro Text"', '"Helvetica Neue"', 'Arial', 'sans-serif'],
        mono: ['"SF Mono"', '"JetBrains Mono"', 'Menlo', 'Monaco', 'Consolas', 'monospace'],
      },
    },
  },
  plugins: [],
};
