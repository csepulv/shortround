import { BrowserRouter, Route, Routes } from 'react-router-dom';
import MuiApp from './MuiApp.jsx';

function Router() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<MuiApp />} />
        <Route path="/mui" element={<MuiApp />} />
        <Route path="/shadcn" element={<MuiApp />} />
      </Routes>
    </BrowserRouter>
  );
}

export default Router;
