import { Box, Paper, Portal, useTheme } from '@mui/material';

export function SidekickPopover({ children, anchorPosition, anchorOrigin, height, totalWidth }) {
  const theme = useTheme();
  return (
    <Portal>
      <Paper
        elevation={1}
        sx={{
          position: 'fixed',
          ...anchorPosition,
          zIndex: (theme) => theme.zIndex.modal + 1,
          height,
          width: totalWidth,
          backgroundColor: 'transparent',
          borderRadius: theme.shape.borderRadius
        }}
      >
        <Box
          sx={{
            backgroundColor: 'transparent',
            display: 'flex',
            height,
            width: totalWidth,
            alignItems: 'flex-start',
            flexDirection: anchorOrigin?.toLowerCase()?.endsWith('right') ? 'row-reverse' : 'row'
          }}
        >
          {children}
        </Box>
      </Paper>
    </Portal>
  );
}
