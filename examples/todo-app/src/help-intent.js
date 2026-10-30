import { RevertIntentionIds } from '@shortround/core';

export const helpIntent = {
  id: 'help',
  title: 'Help',
  subtitle: 'Help',
  icon: 'help',
  action: () => ({
    sideEffects: {
      sidecarRenderer: () => 'THIS IS THE HELP CONTENT'
    },
    includeRevertIntentions: [RevertIntentionIds.BACK],
    intentions: [
      {
        id: 'help::using-app',
        title: 'Using the App',
        subtitle: 'Guidance on app usage',
        icon: 'help',
        group: 'Help',
        action: () => ({
          includeRevertIntentions: [RevertIntentionIds.BACK],
          sideEffects: {
            sidecarRenderer: () => 'Guidance on app usage'
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
          includeRevertIntentions: [RevertIntentionIds.BACK],
          sideEffects: {
            sidecarRenderer: () => 'Common questions (and answers)'
          }
        })
      }
    ],
    selectedIntention: 'help::using-app'
  }),
  group: 'App'
};
