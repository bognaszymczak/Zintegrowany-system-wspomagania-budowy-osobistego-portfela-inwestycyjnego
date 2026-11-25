import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import { App } from './App';
import { SessionProvider } from './session/SessionProvider';

import './styles/tokens.css';
import './styles/base.css';
import './styles/components.css';
import './styles/form.css';
import './styles/pages.css';
import './styles/charts.css';

// Jeden QueryClient na całą aplikację: trzyma odpowiedzi API w pamięci (cache), żeby ekrany nie pytały o to samo dwa razy.
const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } },
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <SessionProvider>
          <App />
        </SessionProvider>
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>,
);
