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
      borderRadius: {
        '2.5xl': '20px',
      },
      boxShadow: {
        modal: '0 -4px 40px rgba(0,0,0,0.12)',
      },
    },
  },
  plugins: [],
}
