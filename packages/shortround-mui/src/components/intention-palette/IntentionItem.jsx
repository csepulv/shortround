import { alpha, Box, Chip, Typography, useTheme } from '@mui/material';

import { CommandIcon, makeShortRoundPaletteStyles } from '../mui-styles.js';

function KeyShortcutChip({ shortcut }) {
  const theme = useTheme();
  if (!shortcut) {
    return null;
  }
  return (
    <Chip
      label={shortcut}
      size="small"
      sx={{
        fontSize: '0.7rem',
        height: 18,
        bgcolor: alpha(theme.palette.grey[500], 0.08),
        border: '1px solid',
        borderColor: alpha(theme.palette.grey[500], 0.2),
        color: 'text.secondary',
        fontFamily: 'monospace',
        '& .MuiChip-label': {
          px: 0.75
        }
      }}
      variant="outlined"
    />
  );
}

// Draws a row; core renders the cmdk item around it (selected rows are styled through `[data-selected]` in the frame).
export function IntentionItem({ intention }) {
  const theme = useTheme();
  const styles = makeShortRoundPaletteStyles(theme);

  return (
    <Box sx={styles.itemFrame}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flex: 1 }}>
        <CommandIcon iconName={intention.icon} />
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography sx={styles.itemTitle} variant="body2">
            {intention.title}
          </Typography>
          {intention.subtitle && (
            <Typography
              sx={{
                color: 'text.secondary',
                display: 'block'
              }}
              variant="caption"
            >
              {intention.subtitle}
            </Typography>
          )}
        </Box>
      </Box>
      <KeyShortcutChip shortcut={intention.shortcut} />
    </Box>
  );
}
