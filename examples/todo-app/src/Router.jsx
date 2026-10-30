import { BrowserRouter, Route, Routes } from 'react-router-dom';

import MuiTextArea from '@/MuiTextArea.jsx';

import MuiSidekickDemo from './MuiSidekickDemo.jsx';
import ShadcnUIApp from './ShadcnUIApp.jsx';

function Router() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<MuiSidekickDemo />} path="/" />
        <Route element={<MuiSidekickDemo />} path="/mui" />
        <Route element={<MuiTextArea />} path="/textarea" />
        <Route element={<ShadcnUIApp />} path="/shadcn-ui" />
      </Routes>
    </BrowserRouter>
  );
}

export default Router;
