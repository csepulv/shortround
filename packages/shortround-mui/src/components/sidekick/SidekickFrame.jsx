import { Paper } from '@mui/material';

export function SidekickFrame({ children, height, commandWidth }) {
  return (
    <Paper
      elevation={3}
      sx={{
        width: commandWidth, // `calc(${commandWidth} - 20px)`,
        backgroundColor: 'background.paper',
        overflow: 'hidden',
        height,
        display: 'flex',
        flexDirection: 'column',
        // In sx a number is a multiple of theme.shape.borderRadius; 1 = the theme's radius.
        borderRadius: 1
      }}
    >
      {children}
    </Paper>
  );
}
