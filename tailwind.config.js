/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        up:      '#F04452',   // 토스 빨강 (상승)
        down:    '#1764ED',   // 토스 파랑 (하락)
        neutral: '#6B7684',
        bg:      '#F2F4F6',   // 토스 배경 회색
        surface: '#FFFFFF',
        border:  '#E5E8EB',
        text1:   '#191F28',   // 토스 primary text
        text2:   '#6B7684',   // 토스 secondary text
        text3:   '#B0B8C1',   // 토스 tertiary text
        primary: '#3182F6',   // 토스 blue
        blue50:  '#EBF3FE',
        red50:   '#FEF0F1',
      },
      fontFamily: {
        sans: ['Pretendard', '-apple-system', 'BlinkMacSystemFont', '"Apple SD Gothic Neo"', '"Noto Sans KR"', 'sans-serif'],
        mono: ['"Roboto Mono"', '"SF Mono"', 'monospace'],
      },
      // CDS 토큰 (ADR-002: Coinbase Design System 구조 차용)
      // spacing은 Tailwind 기본값 유지 (오버라이드 시 기존 유틸리티 깨짐)
      borderRadius: {
        'sm': '4px',
        'DEFAULT': '8px',
        'md': '12px',
        'lg': '16px',
        'xl': '20px',
        '2xl': '24px',
        '2.5xl': '20px',
        'full': '9999px',
      },
      boxShadow: {
        'sm': '0 1px 2px rgba(0,0,0,0.04)',
        'DEFAULT': '0 2px 8px rgba(0,0,0,0.06)',
        'md': '0 4px 16px rgba(0,0,0,0.08)',
        'lg': '0 8px 32px rgba(0,0,0,0.12)',
        modal: '0 -4px 40px rgba(0,0,0,0.12)',
      },
      fontSize: {
        'xs': ['11px', { lineHeight: '16px' }],
        'sm': ['12px', { lineHeight: '18px' }],
        'base': ['14px', { lineHeight: '20px' }],
        'lg': ['16px', { lineHeight: '24px' }],
        'xl': ['20px', { lineHeight: '28px' }],
      },
      keyframes: {
        fadeIn: {
          '0%':   { opacity: '0', transform: 'translateY(4px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        fadeIn: 'fadeIn 0.3s ease-out',
      },
    },
  },
  plugins: [],
}
