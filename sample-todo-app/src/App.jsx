import React from 'react';
import { Box, Button } from '@mui/material';
import { IntentionalDialog } from '@intentional-ui/intentional-mui/src/IntentionalDialog.jsx';
import { SystemIntentIds } from '@intentional-ui/core/src/utils.js';
import {
  IntentionalProvider,
  useIntentionalDialogController
} from '@intentional-ui/intentional-mui/src/useIntentionalDialogController.js';

const help = {
  id: 'help',
  title: 'Help',
  subtitle: 'Help',
  icon: 'help',
  action: () => ({
    systemIntentions: [SystemIntentIds.BACK],
    intentions: [
      {
        id: 'help::using-app',
        title: 'Using the App',
        subtitle: 'Guidance on app usage',
        icon: 'help',
        group: 'Help',
        action: (text) => {
          console.log(text);
          return { systemIntentions: [SystemIntentIds.BACK] };
        }
      },
      {
        id: 'help::faq',
        title: 'FAQ',
        subtitle: 'Common questions (and answers)',
        icon: 'help',
        group: 'Help',
        action: (text) => {
          console.log(text);
          return { systemIntentions: [SystemIntentIds.BACK] };
        }
      }
    ],
    selectedIntention: 'help::using-app'
  }),
  group: 'App'
};

function ToggleIntentionPalette() {
  const { setIsOpen, isOpen } = useIntentionalDialogController();
  return <Button onClick={() => setIsOpen(!isOpen)}>Click Me</Button>;
}

function App() {
  return (
    <IntentionalProvider>
      <Box sx={{ m: 'auto' }}>
        <ToggleIntentionPalette />
        <Box sx={{ m: 'auto' }}>
          <IntentionalDialog defaultIntentions={[help]} />
        </Box>
      </Box>
    </IntentionalProvider>
  );
}

export default App;
