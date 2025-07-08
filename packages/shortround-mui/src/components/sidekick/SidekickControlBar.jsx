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
  CircleX as CloseIcon,
  Grip as ViewCompactIcon,
  Maximize as FullscreenIcon,
  Minimize as MinimizeIcon
} from 'lucide-react';
import {
  TbBoxAlignBottomLeftFilled as AnchorBottomLeftIcon,
  TbBoxAlignBottomRightFilled as AnchorBottomRightIcon,
  TbBoxAlignTopLeftFilled as AnchorTopLeftIcon,
  TbBoxAlignTopRightFilled as AnchorTopRightIcon,
  TbBoxMargin as AnchorCenterIcon
} from 'react-icons/tb';
import { AnchorPositions } from '@shortround/core';

const anchorIcons = {
  [AnchorPositions.CENTER]: AnchorCenterIcon,
  [AnchorPositions.TOP_LEFT]: AnchorTopLeftIcon,
  [AnchorPositions.TOP_RIGHT]: AnchorTopRightIcon,
  [AnchorPositions.BOTTOM_LEFT]: AnchorBottomLeftIcon,
  [AnchorPositions.BOTTOM_RIGHT]: AnchorBottomRightIcon
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

  const onSizeChange = (event, newVal) => setSize(newVal);

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
