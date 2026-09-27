import { BrowserRouter, Route, Routes } from 'react-router-dom';
import MuiSidekickDemo from './MuiSidekickDemo.jsx';
import ShadcnUIApp from './ShadcnUIApp.jsx';
import MuiTextArea from '@/MuiTextArea.jsx';

function Router() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<MuiSidekickDemo />} />
        <Route path="/mui" element={<MuiSidekickDemo />} />
        <Route path="/textarea" element={<MuiTextArea />} />
        <Route path="/shadcn-ui" element={<ShadcnUIApp />} />
      </Routes>
    </BrowserRouter>
  );
}

export default Router;
