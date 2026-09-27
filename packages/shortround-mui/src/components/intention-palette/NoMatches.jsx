import { Box, Typography } from '@mui/material';

export function NoMatches({ inputValue }) {
  return (
    <Box sx={{ p: 3, textAlign: 'center' }}>
      <Typography color="text.secondary" variant="body2">
        {`No results found for "${inputValue}"`}
      </Typography>
    </Box>
  );
}
