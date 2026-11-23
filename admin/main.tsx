import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from '../src/App';
import { enableAdminApi } from '../src/api/client';
import { I18nProvider } from '../src/i18n';
import '@fortawesome/fontawesome-free/css/all.min.css';
import '../src/styles.css';
import '../src/public-theme.css';

/*
 * Platform Owner console: a separate app (own port / host, own sign-in, own session cookie).
 * Every API call goes to /admin-api, where the server applies the admin scope.
 */
enableAdminApi();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <I18nProvider>
      <App mode="admin" />
    </I18nProvider>
  </React.StrictMode>
);
