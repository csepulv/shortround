import {
  BellRing as NotificationIcon,
  Code as CodeIcon,
  FileText as FileIcon,
  Folder as FolderIcon,
  Home as HomeIcon,
  LayoutDashboard as DashboardIcon,
  Palette as PaletteIcon,
  Search as SearchIcon,
  Settings as SettingsIcon,
  User as PersonIcon
} from 'lucide-react';
import { alpha } from '@mui/material';

export const ANIMATION_DURATION = 0.5;

export function CommandIcon({ iconName }) {
  const iconMap = {
    search: SearchIcon,
    settings: SettingsIcon,
    home: HomeIcon,
    person: PersonIcon,
    folder: FolderIcon,
    file: FileIcon,
    code: CodeIcon,
    palette: PaletteIcon,
    dashboard: DashboardIcon,
    notification: NotificationIcon
  };
  const IconComponent = iconMap[iconName] || SearchIcon;
  return <IconComponent sx={{ fontSize: 18, color: 'action.active' }} />;
}

export function makeShortRoundPaletteStyles(theme) {
  return {
    root: {
      '& [cmdk-input]': {
        fontFamily: 'inherit',
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
      '& [cmdk-list]': {
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
          borderRadius: '4px',
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
        borderRadius: '8px',
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
            borderRadius: '0 2px 2px 0'
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
    frame: {
      display: 'flex',
      alignItems: 'center',
      px: 2,
      py: 1.5,
      borderBottom: 1,
      borderColor: 'divider',
      bgcolor: alpha(theme.palette.primary.main, 0.02)
    },
    input: {
      border: 'none',
      outline: 'none',
      background: 'transparent',
      fontSize: '16px',
      width: '100%',
      color: theme.palette.text.primary,
      fontFamily: theme.typography.fontFamily
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
    itemTitle: {
      fontWeight: 500,
      mb: 0.25
    }
  };
}
