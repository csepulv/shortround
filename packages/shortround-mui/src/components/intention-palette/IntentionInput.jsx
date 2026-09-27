import { alpha, Box, Chip, Typography, useTheme } from '@mui/material';
import { makeShortRoundPaletteStyles } from '../mui-styles.js';
import { Search as SearchIcon } from 'lucide-react';
import { Command as CmdkCommand } from 'cmdk';

function InputErrorMessage({ message }) {
  if (!message) return null;
  return (
    <Typography sx={{ fontSize: '0.75em', ml: 4, mt: 1, mb: 0, color: 'red' }}>
      {message}
    </Typography>
  );
}

export function IntentionInput({ inputValue, inputMessage, onInputChange }) {
  const theme = useTheme();
  const styles = makeShortRoundPaletteStyles(theme);
  return (
    <Box sx={styles.inputArea}>
      <Box sx={styles.inputFrame}>
        <SearchIcon />
        <CmdkCommand.Input
          onValueChange={onInputChange}
          placeholder="Type a intention or search..."
          style={styles.input}
          value={inputValue}
          autoFocus
        />
      </Box>
      <InputErrorMessage message={inputMessage} />
    </Box>
  );
}
