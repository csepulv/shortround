import { makeValidator, requiredAlphanumericDashUnderscoreSpace } from './validation-utils.js';
import { SystemIntentIds } from '@intentional-ui/core/src/utils.js';

export const saveItemIntent = {
  id: 'search::start-build',
  title: 'Search',
  subtitle: 'Search for ...',
  icon: 'search',
  action: () => ({
    intentions: [
      {
        id: 'save-item::execute',
        title: 'Save',
        icon: 'save',
        group: 'Actions',
        disabled: true,
        validate: makeValidator(requiredAlphanumericDashUnderscoreSpace)
      }
    ],
    systemIntentions: [SystemIntentIds.CANCEL]
  }),
  group: 'Common'
};
