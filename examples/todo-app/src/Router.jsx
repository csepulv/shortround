import { BrowserRouter, Route, Routes } from 'react-router-dom';
import MuiApp from './MuiApp.jsx';
import ShadcnUIApp from './ShadcnUIApp.jsx';

function Router() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<MuiApp />} />
        <Route path="/mui" element={<MuiApp />} />
        <Route path="/shadcn-ui" element={<ShadcnUIApp />} />
      </Routes>
    </BrowserRouter>
  );
}

export default Router;
