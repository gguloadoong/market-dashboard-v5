import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from '@coinbase/cds-web/system';
import { defaultTheme } from '@coinbase/cds-web/themes/defaultTheme';
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

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ThemeProvider theme={defaultTheme}>
      <QueryClientProvider client={queryClient}>
        <App />
        <Analytics />
      </QueryClientProvider>
    </ThemeProvider>
  </StrictMode>,
);
