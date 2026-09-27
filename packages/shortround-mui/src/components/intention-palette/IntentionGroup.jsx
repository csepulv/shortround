import { Box, Typography, useTheme } from '@mui/material';
import { makeShortRoundPaletteStyles } from '../mui-styles.js';

export function IntentionGroup({ name }) {
  const theme = useTheme();
  const styles = makeShortRoundPaletteStyles(theme);
  return (
    <Box sx={styles.group}>
      <Typography sx={styles.groupCaption} variant="caption">
        {name}
      </Typography>
    </Box>
  );
}
