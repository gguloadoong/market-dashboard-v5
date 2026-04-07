/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        /* CSS 변수 참조 — tokens.css에서 라이트/다크 자동 전환 */
        up:      'var(--fg-positive)',   // 상승
        down:    'var(--fg-negative)',   // 하락
        neutral: 'var(--fg-neutral)',
        bg:      'var(--bg)',            // 앱 배경
        surface: 'var(--bg-surface)',    // 카드/패널 배경
        border:  'var(--border)',        // 기본 구분선
        text1:   'var(--fg)',            // 기본 텍스트
        text2:   'var(--fg-secondary)',   // 보조 텍스트 (t2)
        text3:   'var(--fg-muted)',      // 약한 텍스트 (t3)
        text4:   'var(--fg-disabled)',   // 비활성 텍스트 (t4)
        primary: 'var(--primary)',       // CTA/링크
        blue50:  'var(--bg-negative)',   // 하락 배경 (라이트: #EBF3FE)
        red50:   'var(--bg-positive)',   // 상승 배경 (라이트: #FEF0F1)
      },
      fontFamily: {
        sans: ['Pretendard', '-apple-system', 'BlinkMacSystemFont', '"Apple SD Gothic Neo"', '"Noto Sans KR"', 'sans-serif'],
        mono: ['"JetBrains Mono"', '"SF Mono"', 'monospace'],
      },
      borderRadius: {
        'sm': '4px',
        'DEFAULT': '8px',
        'md': '12px',
        'lg': '16px',
        'xl': '16px',
        '2xl': '24px',
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
