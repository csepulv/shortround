import React from 'react';
import { Box } from '@mui/material';
import { IntentionalDialog } from '@intentional-ui/intentional-mui/src/IntentionalDialog.jsx';
import { SystemIntentIds } from '@intentional-ui/core/src/utils.js';

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

function App() {
  return (
    <Box sx={{ m: 'auto' }}>
      <IntentionalDialog defaultIntentions={[help]} />
    </Box>
  );
}

export default App;
