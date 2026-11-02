import { alpha, Box, Chip, Typography, useTheme } from '@mui/material';

import { ICON_SIZE } from '../mui-icons.js';
import { makeShortRoundPaletteStyles } from '../mui-styles.js';

// Holds the row's icon, or keeps its place when there is none, so titles line up.
function IconSpace({ icon }) {
  return (
    <Box
      data-testid="mui-icon-space"
      sx={{
        width: ICON_SIZE,
        height: ICON_SIZE,
        flexShrink: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'action.active'
      }}
    >
      {icon}
    </Box>
  );
}

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

// Draws a row; core renders the cmdk item around it (selected rows are styled through `[data-selected]` in the frame)
// and chooses its icon.
export function IntentionItem({ intention, icon }) {
  const theme = useTheme();
  const styles = makeShortRoundPaletteStyles(theme);

  return (
    <Box sx={styles.itemFrame}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flex: 1 }}>
        <IconSpace icon={icon} />
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography sx={styles.itemTitle} variant="body2">
            {intention.title}
          </Typography>
          {intention.subtitle && (
            <Typography
              sx={{
                color: 'text.secondary',
                display: 'block',
                mt: 0.25
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
