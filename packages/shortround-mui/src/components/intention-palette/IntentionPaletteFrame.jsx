import { Box, Paper, useTheme } from '@mui/material';
import { makeShortRoundPaletteStyles } from '../mui-styles.js';

export function IntentionPaletteFrame({ children, height }) {
  const theme = useTheme();
  const styles = makeShortRoundPaletteStyles(theme);
  return (
    <Box sx={{ overflow: 'hidden', height: 'calc(100% - 49px)' }}>
      <Paper
        elevation={0}
        sx={{
          width: '100%',
          height,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden'
        }}
      >
        <Box sx={styles.root}>{children}</Box>;
      </Paper>
    </Box>
  );
}
