import React from 'react';
import { IntentionalDialog } from '@intentional-ui/intentional-mui/src/IntentionalDialog.jsx';

const help = {
  id: 'help',
  title: 'Help',
  subtitle: 'Help',
  icon: 'help',
  action: () => ({
    intentions: [
      {
        id: 'back',
        title: 'Back',
        icon: 'back',
        group: 'Actions',
        action: (text) => console.log(text)
      },
      {
        id: 'help::using-app',
        title: 'Using the App',
        subtitle: 'Guidance on app usage',
        icon: 'help',
        group: 'Help',
        action: (text) => console.log(text)
      },
      {
        id: 'help::faq',
        title: 'FAQ',
        subtitle: 'Common questions (and answers)',
        icon: 'help',
        group: 'Help',
        action: (text) => console.log(text)
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
