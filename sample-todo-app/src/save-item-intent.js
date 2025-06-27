import { makeValidator, requiredAlphanumericDashUnderscoreSpace } from './validation-utils.js';
import { SystemIntentIds } from '@intentional-ui/core/src/utils.js';

export const saveItemIntent = {
  id: 'save::start-build',
  title: 'Save',
  subtitle: 'Save ...',
  icon: 'save',
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
    disableInputMatching: true,
    systemIntentions: [SystemIntentIds.CANCEL]
  }),
  group: 'Common'
};
