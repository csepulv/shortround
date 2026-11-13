import { BrowserRouter, Route, Routes } from 'react-router-dom';

import MuiTextArea from '@/MuiTextArea.jsx';

import TodoChatPage from './chat/TodoChatPage.jsx';
import MuiSidekickDemo from './MuiSidekickDemo.jsx';

function Router() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<MuiSidekickDemo />} path="/" />
        <Route element={<MuiSidekickDemo />} path="/mui" />
        <Route element={<MuiTextArea />} path="/textarea" />
        <Route element={<TodoChatPage />} path="/chat" />
      </Routes>
    </BrowserRouter>
  );
}

export default Router;
