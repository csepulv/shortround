import { SystemIntentIds } from '@intentional-ui/core/src/utils.js';

export const helpIntent = {
  id: 'help',
  title: 'Help',
  subtitle: 'Help',
  icon: 'help',
  action: () => ({
    sideEffects: {},
    systemIntentions: [SystemIntentIds.BACK],
    intentions: [
      {
        id: 'help::using-app',
        title: 'Using the App',
        subtitle: 'Guidance on app usage',
        icon: 'help',
        group: 'Help'
      },
      {
        id: 'help::faq',
        title: 'FAQ',
        subtitle: 'Common questions (and answers)',
        icon: 'help',
        group: 'Help'
      }
    ],
    selectedIntention: 'help::using-app'
  }),
  group: 'App'
};
