import {
  alpha,
  Box,
  IconButton,
  styled,
  ToggleButton,
  ToggleButtonGroup,
  toggleButtonGroupClasses,
  Typography,
  useTheme
} from '@mui/material';
import {
  ArrowDown,
  ArrowDownLeft,
  ArrowDownRight,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  ArrowUpLeft,
  ArrowUpRight,
  CircleX as CloseIcon,
  Crosshair,
  Grip as ViewCompactIcon,
  Maximize as FullscreenIcon,
  Minimize as MinimizeIcon
} from 'lucide-react';
import { AnchorPositions } from '@shortround/core';

const anchorIcons = {
  [AnchorPositions.CENTER]: Crosshair,
  [AnchorPositions.TOP_LEFT]: ArrowUpLeft,
  [AnchorPositions.TOP]: ArrowUp,
  [AnchorPositions.TOP_RIGHT]: ArrowUpRight,
  [AnchorPositions.RIGHT]: ArrowRight,
  [AnchorPositions.BOTTOM_RIGHT]: ArrowDownRight,
  [AnchorPositions.BOTTOM]: ArrowDown,
  [AnchorPositions.BOTTOM_LEFT]: ArrowDownLeft,
  [AnchorPositions.LEFT]: ArrowLeft
};

function ChangeAnchorPosition({ onCycleAnchorOrigin, position }) {
  const AnchorIcon = anchorIcons[position];
  return (
    <IconButton onClick={onCycleAnchorOrigin} sx={{ mr: 2 }}>
      <AnchorIcon />
    </IconButton>
  );
}

const ControlBarBox = styled('div', {
  name: 'ShortRoundSidekickControlBar',
  slot: 'root'
})(({ theme }) => ({
  display: 'flex',
  flex: '0 0 auto',
  alignItems: 'center',
  px: 2,
  py: 1,
  borderBottom: '1px solid',
  borderColor: theme.palette.divider,
  backgroundColor: alpha(theme.palette.primary.main, 0.02)
}));

export function SidekickControlBar({
  title,
  cycleAnchorOrigin,
  anchorOrigin,
  onClose,
  setSize,
  size
}) {
  const theme = useTheme();

  // An exclusive ToggleButtonGroup emits null when the selected button is clicked again.
  const onSizeChange = (event, newVal) => {
    if (newVal === null) return;
    setSize(newVal);
  };

  return (
    <ControlBarBox>
      <ChangeAnchorPosition onCycleAnchorOrigin={cycleAnchorOrigin} position={anchorOrigin} />
      <Typography
        component="div"
        sx={{ flexGrow: 1, color: 'surfaceHeader.contrastText' }}
        variant="h6"
      >
        {title}
      </Typography>
      <ToggleButtonGroup
        sx={{
          mr: 2,
          [`& .${toggleButtonGroupClasses.grouped}`]: {
            border: 0,
            borderRadius: theme.shape.borderRadius,
            [`&.${toggleButtonGroupClasses.disabled}`]: {
              border: 0
            }
          }
        }}
        value={size}
        exclusive
        onChange={onSizeChange}
        aria-label="sidekick size"
      >
        <ToggleButton value="compact" aria-label="compact">
          <MinimizeIcon fontSize="small" />
        </ToggleButton>
        <ToggleButton value="medium" aria-label="medium">
          <ViewCompactIcon fontSize="small" />
        </ToggleButton>
        <ToggleButton value="full" aria-label="full">
          <FullscreenIcon fontSize="small" />
        </ToggleButton>
      </ToggleButtonGroup>
      <IconButton onClick={onClose} size="small">
        <CloseIcon fontSize="small" />
      </IconButton>
    </ControlBarBox>
  );
}
