import { isNative } from './native/platform';
﻿import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import { Analytics } from '@vercel/analytics/react';
import { SpeedInsights } from '@vercel/speed-insights/react';
import App from './App.tsx';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
    {!isNative && <Analytics />}
    {!isNative && <SpeedInsights />}
  </StrictMode>,
);
