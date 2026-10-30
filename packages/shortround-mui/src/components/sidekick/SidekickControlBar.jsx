import {
  IconButton,
  styled,
  ToggleButton,
  ToggleButtonGroup,
  toggleButtonGroupClasses,
  Typography
} from '@mui/material';
import { AnchorPositions } from '@shortround/core';
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

function ChangeAnchorPosition({ onCycleAnchorOrigin, position, label }) {
  const AnchorIcon = anchorIcons[position];
  return (
    <IconButton
      aria-label={label}
      data-testid="shortround-anchor"
      onClick={onCycleAnchorOrigin}
      sx={{ mr: 2 }}
    >
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
  // styled() takes plain CSS, not sx shorthands like px/py. Horizontal only: the header's
  // height feeds fixed offsets in IntentionPaletteFrame and ShortRoundPalette.
  padding: theme.spacing(0, 1),
  borderBottom: '1px solid',
  borderColor: theme.palette.divider,
  backgroundColor: theme.palette.background.paper
}));

// The controls' accessible names come from core (`labels`), so they are the same in every theme.
export function SidekickControlBar({
  title,
  labels,
  cycleAnchorOrigin,
  anchorOrigin,
  onClose,
  setSize,
  size
}) {
  // An exclusive ToggleButtonGroup emits null when the selected button is clicked again.
  const onSizeChange = (event, newVal) => {
    if (newVal === null) {
      return;
    }
    setSize(newVal);
  };

  return (
    <ControlBarBox>
      <ChangeAnchorPosition
        label={labels.anchor}
        onCycleAnchorOrigin={cycleAnchorOrigin}
        position={anchorOrigin}
      />
      <Typography component="div" sx={{ flexGrow: 1, color: 'text.primary' }} variant="h6">
        {title}
      </Typography>
      <ToggleButtonGroup
        aria-label={labels.size}
        exclusive
        onChange={onSizeChange}
        sx={{
          mr: 2,
          [`& .${toggleButtonGroupClasses.grouped}`]: {
            border: 0,
            borderRadius: 1,
            [`&.${toggleButtonGroupClasses.disabled}`]: {
              border: 0
            }
          }
        }}
        value={size}
      >
        <ToggleButton
          aria-label={labels.sizes.compact}
          data-testid="shortround-size-compact"
          value="compact"
        >
          <MinimizeIcon fontSize="small" />
        </ToggleButton>
        <ToggleButton
          aria-label={labels.sizes.medium}
          data-testid="shortround-size-medium"
          value="medium"
        >
          <ViewCompactIcon fontSize="small" />
        </ToggleButton>
        <ToggleButton
          aria-label={labels.sizes.full}
          data-testid="shortround-size-full"
          value="full"
        >
          <FullscreenIcon fontSize="small" />
        </ToggleButton>
      </ToggleButtonGroup>
      <IconButton
        aria-label={labels.close}
        data-testid="shortround-close"
        onClick={onClose}
        size="small"
      >
        <CloseIcon fontSize="small" />
      </IconButton>
    </ControlBarBox>
  );
}
