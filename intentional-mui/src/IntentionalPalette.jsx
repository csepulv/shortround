import { Search as SearchIcon } from 'lucide-react';
import { alpha, Box, Chip, Typography, useTheme } from '@mui/material';
import { Command as CmdkCommand } from 'cmdk';
import { useMemo } from 'react';

import { CommandIcon, makeIntentionalPaletteStyles } from './mui-styles.js';
import { useIntentionalDialogController } from './useIntentionalDialogController.js';
import { useIntentional } from '@intentional-ui/core/src/useIntentional.js';

function ShortcutChip({ shortcut }) {
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

export function IntentionalPalette({ defaultIntentions }) {
  const { inputValue, updateInputValue, intentions, dispatch } = useIntentional({
    defaultIntentions
  });
  const { height, setSidecarRenderer, closeSidecar } = useIntentionalDialogController();
  const theme = useTheme();

  const styles = makeIntentionalPaletteStyles(theme);

  const intentionGroups = useMemo(() => {
    return intentions.reduce((acc, intention) => {
      const groupName = intention.group;
      let group = acc.find((g) => g.name === groupName);
      if (!group) {
        group = { name: groupName, intentions: [] };
        acc.push(group);
      }
      group.intentions.push(intention);
      return acc;
    }, []);
  }, [intentions]);

  return (
    <Box sx={styles.root}>
      <CmdkCommand shouldFilter={false}>
        <Box sx={styles.frame}>
          <SearchIcon sx={{ mr: 1, color: 'action.active' }} />
          <CmdkCommand.Input
            onValueChange={updateInputValue}
            placeholder="Type a intention or search..."
            style={styles.input}
            value={inputValue}
            autoFocus
          />
        </Box>

        <CmdkCommand.List
          style={{
            height: `calc(${height} - 107px`,
            overflowY: 'auto',
            padding: '8px 0'
          }}
        >
          <CmdkCommand.Empty>
            <Box sx={{ p: 3, textAlign: 'center' }}>
              <Typography color="text.secondary" variant="body2">
                {`No results found for "${inputValue}"`}
              </Typography>
            </Box>
          </CmdkCommand.Empty>

          {intentionGroups.map((group) => (
            <CmdkCommand.Group key={group.name}>
              <Box sx={styles.group}>
                <Typography sx={styles.groupCaption} variant="caption">
                  {group.name}
                </Typography>
              </Box>

              {group.intentions.map((intention) => (
                <CmdkCommand.Item
                  className="intention-item"
                  disabled={intention.disabled}
                  key={intention.id}
                  keywords={intention.keywords}
                  onSelect={async (id) => {
                    const result = await dispatch(id);
                    if (result?.sideEffects?.sidecarRenderer) {
                      setSidecarRenderer(result.sideEffects?.sidecarRenderer);
                    } else {
                      closeSidecar();
                    }
                  }}
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
                    <ShortcutChip shortcut={intention.shortcut} />
                  </Box>
                </CmdkCommand.Item>
              ))}
            </CmdkCommand.Group>
          ))}
        </CmdkCommand.List>
      </CmdkCommand>
    </Box>
  );
}
