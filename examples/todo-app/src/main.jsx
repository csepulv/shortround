import React from 'react';
import ReactDOM from 'react-dom/client';
import Router from './Router.jsx';
import './index.css';
import { IntentionalProvider } from '@shortround/shadcnui';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <IntentionalProvider>
      <Router />
    </IntentionalProvider>
  </React.StrictMode>
);
