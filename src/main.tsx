import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';
import { I18nProvider } from './i18n';
import '@fortawesome/fontawesome-free/css/all.min.css';
import './styles.css';
import './public-theme.css';
import './viewport-fit.css';
import './theme-line.css';
import { applyTheme, readStoredTheme } from './theme';

// set the saved colour theme before the first paint
applyTheme(readStoredTheme());

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <I18nProvider>
      <App />
    </I18nProvider>
  </React.StrictMode>
);
