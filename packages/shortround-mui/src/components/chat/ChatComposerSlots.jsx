import { Box, ListItemButton, Paper, Typography, useTheme } from '@mui/material';
import { useLayoutEffect, useRef } from 'react';

import { lineRoleStyles } from '../mui-styles.js';

export function ChatFrame({ children }) {
  const theme = useTheme();
  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        minHeight: 0,
        fontFamily: theme.typography.fontFamily,
        ...lineRoleStyles(theme)
      }}
    >
      {children}
    </Box>
  );
}

export const ChatComposer = ({ rows, input }) => (
  <Box sx={{ position: 'relative', px: 1.5, pt: 1, pb: 1.5, borderTop: 1, borderColor: 'divider' }}>
    {rows && (
      <Paper
        component="ul"
        elevation={3}
        role="listbox"
        sx={{
          position: 'absolute',
          right: 12,
          bottom: '100%',
          left: 12,
          maxHeight: 240,
          overflowY: 'auto',
          m: 0,
          p: 0.5,
          listStyle: 'none'
        }}
      >
        {rows}
      </Paper>
    )}
    {input}
  </Box>
);

export function ChatRow({ row, isHighlighted, onChoose }) {
  const ref = useScrolledIntoViewWhen(isHighlighted);
  const fontStyle = row.missing ? 'italic' : 'normal';
  return (
    <li
      aria-disabled={row.disabled || undefined}
      aria-selected={isHighlighted}
      ref={ref}
      role="option"
    >
      <ListItemButton
        aria-disabled={undefined}
        component="div"
        dense
        disabled={row.disabled}
        onClick={onChoose}
        onMouseDown={(event) => event.preventDefault()}
        role="presentation"
        selected={isHighlighted}
        sx={{ borderRadius: 1, gap: 1, alignItems: 'baseline' }}
        tabIndex={-1}
      >
        <Typography
          color="text.secondary"
          sx={{ minWidth: 72, textTransform: 'uppercase', letterSpacing: 0.5 }}
          variant="caption"
        >
          {row.group}
        </Typography>
        <Typography sx={{ fontStyle }} variant="body2">
          {row.title}
        </Typography>
        {row.subtitle && (
          <Typography color="text.secondary" sx={{ fontStyle }} variant="caption">
            {row.subtitle}
          </Typography>
        )}
      </ListItemButton>
    </li>
  );
}

export const ChatInput = ({ input }) => <Box sx={INPUT_STYLES}>{input}</Box>;

function useScrolledIntoViewWhen(isHighlighted) {
  const ref = useRef(null);
  useLayoutEffect(() => {
    if (isHighlighted) {
      ref.current?.scrollIntoView?.({ block: 'nearest' });
    }
  }, [isHighlighted]);
  return ref;
}

const INPUT_STYLES = {
  '& [data-testid="shortround-chat-input"]': {
    width: '100%',
    boxSizing: 'border-box',
    px: 1.25,
    py: 1,
    border: 1,
    borderColor: 'divider',
    borderRadius: 1,
    bgcolor: 'background.paper',
    color: 'text.primary',
    font: 'inherit',
    fontSize: 15,
    lineHeight: 1.4,
    resize: 'none',
    '&::placeholder': { color: 'text.secondary', opacity: 1 },
    '&:focus': { outline: 'none', borderColor: 'primary.main' }
  }
};
