import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig(({ mode }) => ({
  // GitHub Pages는 /market-dashboard-v2/ 경로에서 서빙 — Vercel은 / 유지
  base: process.env.GITHUB_PAGES === 'true' ? '/market-dashboard-v2/' : '/',
  server: {
    // 로컬 개발 시 /api/* 요청을 프로덕션 Vercel로 프록시
    proxy: {
      '/api': {
        target: 'https://market-dashboard-v2-mu.vercel.app',
        changeOrigin: true,
        secure: true,
      },
    },
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'icons/icon-192.png', 'icons/icon-512.png'],
      manifest: {
        name: '마켓레이더',
        short_name: '마켓레이더',
        description: '국장·미장·코인 실시간 급등 종목 모니터링',
        theme_color: '#863bff',
        background_color: '#F8F9FA',
        display: 'standalone',
        orientation: 'portrait',
        scope: '/',
        start_url: '/',
        icons: [
          {
            src: '/icons/icon-192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: '/icons/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
          },
          {
            src: '/icons/icon-maskable.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
        shortcuts: [
          {
            name: '시그널 피드',
            short_name: '시그널',
            url: '/?tab=signal',
            icons: [{ src: '/icons/icon-192.png', sizes: '192x192' }],
          },
          {
            name: '고래 알림',
            short_name: '고래',
            url: '/?tab=whale',
            icons: [{ src: '/icons/icon-192.png', sizes: '192x192' }],
          },
          {
            name: '관심종목',
            short_name: '관심',
            url: '/?tab=watchlist',
            icons: [{ src: '/icons/icon-192.png', sizes: '192x192' }],
          },
        ],
      },
      workbox: {
        // navigateFallback: null — navigation 요청은 항상 네트워크에서 서빙
        // SW가 HTML을 인터셉트하면 blank page 위험이 있으므로 비활성화
        navigateFallback: null,
        // 새 SW 즉시 활성화 — 이전 캐시 즉시 교체
        skipWaiting: true,
        clientsClaim: true,
        // 이전 버전 precache 자동 정리
        cleanupOutdatedCaches: true,
        // JS/CSS/폰트/아이콘만 precache (HTML 제외 — 항상 최신 서버 버전 사용)
        globPatterns: ['**/*.{js,css,woff2,png}'],
        runtimeCaching: [
          {
            // 구글 폰트 캐시
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'CacheFirst',
            options: { cacheName: 'google-fonts', expiration: { maxAgeSeconds: 60 * 60 * 24 * 365 } },
          },
        ],
      },
    }),
  ],
  // 프로덕션 빌드: console.log/warn/info/debug를 dead code로 처리해 번들에서 제거
  // console.error는 보존 — React 런타임 오류·미처리 Promise rejection 디버깅 필요
  esbuild: {
    pure: mode === 'production' ? ['console.log', 'console.warn', 'console.info', 'console.debug'] : [],
  },
  test: {
    environment: 'node',
    globals: true,
    exclude: ['e2e/**', 'node_modules/**'],
  },
  build: {
    chunkSizeWarningLimit: 500,
    rollupOptions: {
      output: {
        // 차트 라이브러리를 별도 청크로 분리 (코드 스플리팅)
        manualChunks(id) {
          if (id.includes('lightweight-charts') || id.includes('recharts')) return 'charts';
          if (id.includes('react-dom') || id.includes('react/')) return 'react';
          if (id.includes('@tanstack/react-query')) return 'query';
        },
      },
    },
  },
}))
