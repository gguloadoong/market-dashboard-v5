/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        up:      '#FF4136',
        down:    '#1A73E8',
        neutral: '#8B95A1',
        bg:      '#F8F9FA',
        surface: '#FFFFFF',
        border:  '#E8ECF0',
        text1:   '#191F28',
        text2:   '#8B95A1',
        text3:   '#B0B8C1',
        primary: '#3182F6',
      },
      fontFamily: {
        mono: ['"JetBrains Mono"', '"Fira Code"', 'monospace'],
        sans: ['Pretendard', '-apple-system', '"Apple SD Gothic Neo"', '"Noto Sans KR"', 'sans-serif'],
      },
      boxShadow: {
        card:  '0 1px 4px rgba(0,0,0,0.06)',
        hover: '0 6px 20px rgba(0,0,0,0.1)',
        modal: '0 20px 60px rgba(0,0,0,0.15)',
      },
      animation: {
        ticker:    'ticker var(--dur,40s) linear infinite',
        surgeGlow: 'surgeGlow 2s ease infinite',
        fadeIn:    'fadeIn 0.15s ease',
        slideUp:   'slideUp 0.2s ease',
        modalIn:   'modalIn 0.2s ease',
      },
      keyframes: {
        ticker:    { from: { transform: 'translateX(0)' }, to: { transform: 'translateX(-50%)' } },
        surgeGlow: { '0%,100%': { boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }, '50%': { boxShadow: '0 4px 20px rgba(255,65,54,0.25)' } },
        fadeIn:    { from: { opacity: 0 }, to: { opacity: 1 } },
        slideUp:   { from: { opacity: 0, transform: 'translateY(8px)' }, to: { opacity: 1, transform: 'translateY(0)' } },
        modalIn:   { from: { opacity: 0, transform: 'translateY(20px) scale(0.97)' }, to: { opacity: 1, transform: 'translateY(0) scale(1)' } },
      },
    },
  },
  plugins: [],
}

