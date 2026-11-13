import { alpha, Box, Typography } from '@mui/material';

const TOOL_RESULTS = {
  running: () => 'Running…',
  done: ({ output }) => (typeof output === 'string' ? output : JSON.stringify(output)),
  refused: ({ errorText }) => `Refused: ${errorText}`
};

export const ChatTranscript = ({ children }) => (
  <Box
    component="ol"
    sx={{ flex: '1 1 auto', minHeight: 0, overflowY: 'auto', m: 0, p: 1.5, listStyle: 'none' }}
  >
    {children}
  </Box>
);

export const ChatMessage = ({ role, children }) => (
  <Box
    component="li"
    sx={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: role === 'user' ? 'flex-end' : 'flex-start',
      gap: 0.5,
      mb: 1.25
    }}
  >
    {children}
  </Box>
);

export function ChatText({ role, children }) {
  if (role === 'user') {
    return (
      <Typography
        component="div"
        sx={{
          maxWidth: '80%',
          px: 1.25,
          py: 0.75,
          borderRadius: 2,
          bgcolor: (theme) => alpha(theme.palette.primary.main, 0.1),
          whiteSpace: 'pre-wrap'
        }}
        variant="body2"
      >
        {children}
      </Typography>
    );
  }
  return (
    <Typography component="div" sx={MARKDOWN_STYLES} variant="body2">
      {children}
    </Typography>
  );
}

export const ChatIntentionRun = ({ line, message }) => (
  <RunLine>
    <Code>{line}</Code> {message}
  </RunLine>
);

export const ChatToolRun = (props) => (
  <RunLine>
    <Code>
      {props.label} {JSON.stringify(props.input ?? {})}
    </Code>{' '}
    <span>{TOOL_RESULTS[props.state](props)}</span>
  </RunLine>
);

export const ChatError = ({ message }) => (
  <Box component="li" sx={{ mb: 1.25 }}>
    <Typography color="error" variant="body2">
      {message}
    </Typography>
  </Box>
);

const RunLine = ({ children }) => (
  <Typography color="text.secondary" component="div" variant="caption">
    {children}
  </Typography>
);

const Code = ({ children }) => (
  <Box
    component="code"
    sx={{
      px: 0.5,
      borderRadius: 0.5,
      bgcolor: (theme) => alpha(theme.palette.grey[500], 0.12),
      fontFamily: 'monospace'
    }}
  >
    {children}
  </Box>
);

const MARKDOWN_STYLES = {
  lineHeight: 1.45,
  '& p': { m: 0, mb: 1 },
  '& > :first-of-type': { mt: 0 },
  '& > :last-child': { mb: 0 },
  '& ul, & ol': { m: 0, mb: 1, pl: 2.5 },
  '& code': {
    px: 0.5,
    borderRadius: 0.5,
    bgcolor: (theme) => alpha(theme.palette.grey[500], 0.12),
    fontFamily: 'monospace'
  },
  '& table': { borderCollapse: 'collapse' },
  '& th, & td': { px: 1, py: 0.5, border: 1, borderColor: 'divider' }
};
