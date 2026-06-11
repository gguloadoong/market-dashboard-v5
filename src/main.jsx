import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Analytics } from '@vercel/analytics/react';
import './index.css';
import App from './App.jsx';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime:           60 * 1000,
      retry:               1,
      refetchOnWindowFocus: false,
    },
  },
});

// #402: CDS ThemeProvider 제거 — #186에서 CDS 컴포넌트가 전부 직접 구현으로 교체된 뒤
// 테마 컨텍스트를 소비하는 CDS 컴포넌트가 0개라 순수 데드 래퍼였음.
createRoot(document.getElementById('root')).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
      <Analytics />
    </QueryClientProvider>
  </StrictMode>,
);
