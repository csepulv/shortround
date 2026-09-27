import { Box, Paper } from '@mui/material';

export function SidecarContent({ isOpen, height, renderSidecar }) {
  return (
    <Paper
      elevation={8}
      sx={{
        width: '100%',
        height,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden'
      }}
    >
      <Box sx={{ flex: 1, overflow: 'auto', m: 4 }}>{isOpen ? renderSidecar() : null}</Box>
    </Paper>
  );
}
