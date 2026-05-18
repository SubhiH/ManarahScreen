import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import Display from '@/pages/Display';
import Admin from '@/pages/Admin';
import Live from '@/pages/Live';
import ThemeApplier from '@/components/ThemeApplier';
import './index.css';

const qc = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      staleTime: 30_000,
      retry: 1,
    },
  },
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={qc}>
      <BrowserRouter>
        <ThemeApplier />
        <Routes>
          <Route path="/" element={<Display />} />
          <Route path="/admin" element={<Admin />} />
          <Route path="/live" element={<Live />} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  </React.StrictMode>,
);
