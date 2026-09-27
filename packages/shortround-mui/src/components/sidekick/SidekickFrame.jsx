import { alpha, Paper, useTheme } from '@mui/material';

export function SidekickFrame({ children, height, commandWidth }) {
  const theme = useTheme();
  return (
    <Paper
      elevation={3}
      sx={{
        width: commandWidth, // `calc(${commandWidth} - 20px)`,
        backgroundColor: alpha(theme.palette.primary.main, 0.02),
        overflow: 'hidden',
        height,
        display: 'flex',
        flexDirection: 'column',
        borderRadius: theme.shape.borderRadius
      }}
    >
      {children}
    </Paper>
  );
}
