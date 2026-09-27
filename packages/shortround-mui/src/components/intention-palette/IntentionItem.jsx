import { alpha, Box, Chip, Typography, useTheme } from '@mui/material';
import { Command as CmdkCommand } from 'cmdk';
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

export function IntentionItem({ intention, onSelect }) {
  const theme = useTheme();
  const styles = makeShortRoundPaletteStyles(theme);

  return (
    <CmdkCommand.Item
      className="intention-item"
      disabled={intention.disabled}
      key={intention.id}
      keywords={intention.keywords}
      onSelect={onSelect}
      value={intention.id}
    >
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
    </CmdkCommand.Item>
  );
}
