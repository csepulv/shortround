import { alpha } from '@mui/material';

// The typed line's words, by role (core's react input marks them). Colour only: the words sit under the input's own
// text, so a wider word (bold, say) would move the rest away from the caret.
export const lineRoleStyles = (theme) => ({
  '& [data-role="verb"]': { color: theme.palette.primary.main },
  '& [data-role="hint"]': { color: theme.palette.secondary.main },
  '& [data-role="param"]': { color: theme.palette.info.main },
  '& [data-role="value"]': { color: theme.palette.success.main },
  '& [data-role="unread"]': { color: alpha(theme.palette.text.primary, 0.6) },
  '& [data-role="broken"]': {
    color: theme.palette.error.main,
    textDecoration: 'underline wavy'
  },
  '& [data-role="ghost"]': { color: alpha(theme.palette.text.primary, 0.35) }
});

export function makeShortRoundPaletteStyles(theme) {
  return {
    root: {
      '& [cmdk-input]': {
        marginLeft: '8px',
        fontFamily: theme.typography.fontFamily,
        color: theme.palette.text.primary,
        border: 'none',
        outline: 'none',
        background: 'transparent',
        fontSize: '16px',
        width: '100%',
        caretColor: 'currentColor',
        '&::placeholder': {
          color: alpha(theme.palette.text.primary, 0.5)
        }
      },
      ...lineRoleStyles(theme),
      '& [cmdk-list]': {
        // cmdk's list takes focus on a mouse click (tabIndex -1) but is never a keyboard target, so its ring
        // tells nobody anything; keyboard focus stays on the input.
        '&:focus': {
          outline: 'none'
        },
        overflowY: 'auto',
        overscrollBehavior: 'contain',
        transition: 'height 100ms ease',
        '&::-webkit-scrollbar': {
          width: '8px'
        },
        '&::-webkit-scrollbar-track': {
          background: 'transparent'
        },
        '&::-webkit-scrollbar-thumb': {
          background: alpha(theme.palette.text.primary, 0.1),
          // These styles are applied through sx, where a number is a multiple of the theme radius.
          borderRadius: 1,
          '&:hover': {
            background: alpha(theme.palette.text.primary, 0.2)
          }
        }
      },
      '& [cmdk-group]': {
        overflow: 'hidden'
      },
      '& [cmdk-group-heading]': {
        userSelect: 'none',
        fontSize: '12px',
        color: alpha(theme.palette.text.primary, 0.5),
        fontWeight: 500,
        marginBottom: '8px'
      },
      '& [cmdk-item]': {
        cursor: 'pointer',
        height: 'auto',
        margin: theme.spacing(0.5),
        borderRadius: 1,
        fontSize: '14px',
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        color: alpha(theme.palette.text.primary, 0.9),
        userSelect: 'none',
        willChange: 'background, color',
        transition: 'all 150ms ease',
        position: 'relative',
        '&[data-disabled="true"]': {
          color: theme.palette.text.disabled,
          cursor: 'not-allowed',
          '& .MuiTypography-root': {
            color: theme.palette.text.disabled
          }
        },
        '&[data-selected="true"]': {
          background: alpha(theme.palette.primary.main, 0.12),
          color: theme.palette.primary.main,
          '&::after': {
            content: '""',
            position: 'absolute',
            left: 0,
            top: '50%',
            transform: 'translateY(-50%)',
            width: '3px',
            height: '60%',
            background: theme.palette.primary.main,
            borderRadius: 1
          }
        },
        '&:active': {
          transitionDuration: '0ms'
        },
        '& + [cmdk-item]': {
          marginTop: '4px'
        },
        '&:last-child': {
          marginBottom: '8px'
        },
        '&:hover': {
          bgcolor: alpha(theme.palette.primary.main, 0.08)
        },
        '&[data-disabled="true"]:hover': {
          bgcolor: 'transparent'
        }
      },
      '& [cmdk-separator]': {
        height: '1px',
        width: '100%',
        background: alpha(theme.palette.text.primary, 0.1),
        margin: '4px 0'
      }
    },
    inputFrame: {
      width: '100%',
      display: 'flex',
      alignItems: 'center',
      borderColor: 'divider',
      bgcolor: alpha(theme.palette.primary.main, 0.02)
    },
    inputArea: {
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'flex-start',
      px: 2,
      py: 1.5,
      borderBottom: 1,
      borderColor: 'divider',
      bgcolor: alpha(theme.palette.primary.main, 0.02)
    },
    group: {
      px: 2,
      py: 1,
      borderBottom: 1,
      borderColor: 'divider',
      bgcolor: alpha(theme.palette.grey[500], 0.05)
    },
    groupCaption: {
      fontWeight: 600,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
      color: 'text.secondary'
    },
    itemFrame: {
      display: 'flex',
      alignItems: 'center',
      width: '100%',
      px: 2,
      py: 1,
      cursor: 'pointer',
      '&:hover': {
        bgcolor: alpha(theme.palette.primary.main, 0.08)
      },
      '&[data-disabled="true"]:hover': {
        bgcolor: 'transparent'
      },
      '&[data-selected="true"]': {
        bgcolor: alpha(theme.palette.primary.main, 0.12)
      }
    },
    // No margin below the title: a single-line row's icon centres on the title's line. The subtitle carries the gap.
    itemTitle: {
      fontWeight: 500
    }
  };
}
