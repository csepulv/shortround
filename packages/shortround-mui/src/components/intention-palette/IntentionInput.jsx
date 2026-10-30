import { Box, Typography, useTheme } from '@mui/material';
import { Search as SearchIcon } from 'lucide-react';

import { makeShortRoundPaletteStyles } from '../mui-styles.js';

function InputErrorMessage({ message }) {
  if (!message) {
    return null;
  }
  return (
    <Typography sx={{ fontSize: '0.75em', ml: 4, mt: 1, mb: 0, color: 'red' }}>
      {message}
    </Typography>
  );
}

// Places core's input (styled through `[cmdk-input]` in the palette frame) beside a search icon.
export function IntentionInput({ input, inputMessage }) {
  const theme = useTheme();
  const styles = makeShortRoundPaletteStyles(theme);
  return (
    <Box sx={styles.inputArea}>
      <Box sx={styles.inputFrame}>
        <SearchIcon />
        {input}
      </Box>
      <InputErrorMessage message={inputMessage?.text} />
    </Box>
  );
}
