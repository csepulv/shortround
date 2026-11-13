import {
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Paper,
  Stack,
  Typography
} from '@mui/material';
import { ThemeProvider as MuiThemeProvider } from '@mui/material/styles';
import { IntentionChat } from '@shortround/chat';
import { muiTheme } from '@shortround/mui';
import { ShortRoundProvider } from '@shortround/react';
import { DefaultChatTransport } from 'ai';
import { CheckCircle2, Circle } from 'lucide-react';
import { useState, useSyncExternalStore } from 'react';

import { theme } from '../MuiSidekickDemo.jsx';
import { makeTodos } from './todos.js';

function TodoChatPage() {
  const [{ store, runtime }] = useState(makeTodos);
  const [transport] = useState(() => new DefaultChatTransport({ api: '/api/chat' }));

  return (
    <MuiThemeProvider theme={theme}>
      <ShortRoundProvider theme={muiTheme}>
        <Stack direction="row" spacing={4} sx={{ p: 4, height: '100vh', boxSizing: 'border-box' }}>
          <TodoList store={store} />
          <Paper sx={{ flex: 1, maxWidth: 640, minHeight: 0 }} variant="outlined">
            <IntentionChat runtime={runtime} transport={transport} />
          </Paper>
        </Stack>
      </ShortRoundProvider>
    </MuiThemeProvider>
  );
}

function TodoList({ store }) {
  const { filter } = useSyncExternalStore(store.subscribe, store.getState);
  return (
    <Paper data-testid="todo-list" sx={{ width: 280, p: 2 }} variant="outlined">
      <Typography variant="subtitle2">Todos ({filter})</Typography>
      <List dense>
        {store.visibleTodos().map((todo) => (
          <ListItem data-done={todo.isDone} data-testid={`todo-${todo.id}`} key={todo.id}>
            <ListItemIcon sx={{ minWidth: 28 }}>
              {todo.isDone ? <CheckCircle2 size={18} /> : <Circle size={18} />}
            </ListItemIcon>
            <ListItemText
              primary={todo.title}
              sx={{ textDecoration: todo.isDone ? 'line-through' : 'none' }}
            />
          </ListItem>
        ))}
      </List>
    </Paper>
  );
}

export default TodoChatPage;
