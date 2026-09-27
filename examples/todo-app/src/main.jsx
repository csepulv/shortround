import React from 'react';
import ReactDOM from 'react-dom/client';
import Router from './Router.jsx';
import './index.css';
import { ShortRoundProvider } from '@shortround/shadcn-ui';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ShortRoundProvider>
      <Router />
    </ShortRoundProvider>
  </React.StrictMode>
);
