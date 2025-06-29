import { SystemIntentIds } from '@shortround/core';

export const helpIntent = {
  id: 'help',
  title: 'Help',
  subtitle: 'Help',
  icon: 'help',
  action: () => ({
    sideEffects: {
      sidecarRenderer: () => {
        return 'THIS IS THE HELP CONTENT';
      }
    },
    systemIntentions: [SystemIntentIds.BACK],
    intentions: [
      {
        id: 'help::using-app',
        title: 'Using the App',
        subtitle: 'Guidance on app usage',
        icon: 'help',
        group: 'Help',
        action: () => ({
          systemIntentions: [SystemIntentIds.BACK],
          sideEffects: {
            sidecarRenderer: () => {
              return 'Guidance on app usage';
            }
          }
        })
      },
      {
        id: 'help::faq',
        title: 'FAQ',
        subtitle: 'Common questions (and answers)',
        icon: 'help',
        group: 'Help',
        action: () => ({
          systemIntentions: [SystemIntentIds.BACK],
          sideEffects: {
            sidecarRenderer: () => {
              return 'Common questions (and answers)';
            }
          }
        })
      }
    ],
    selectedIntention: 'help::using-app'
  }),
  group: 'MuiApp'
};
