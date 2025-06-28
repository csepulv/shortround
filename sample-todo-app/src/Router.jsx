import { BrowserRouter, Route, Routes } from 'react-router-dom';
import MuiApp from './MuiApp.jsx';
import ShadcnApp from './ShadcnApp.jsx';

function Router() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<MuiApp />} />
        <Route path="/mui" element={<MuiApp />} />
        <Route path="/shadcn" element={<ShadcnApp />} />
      </Routes>
    </BrowserRouter>
  );
}

export default Router;
