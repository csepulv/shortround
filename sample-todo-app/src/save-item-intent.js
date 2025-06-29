import { makeValidator, requiredAlphanumericDashUnderscoreSpace } from './validation-utils.js';
import { SystemIntentIds } from '@shortround/core';

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
        subtitle: 'Please specify a name.',
        icon: 'save',
        group: 'Actions',
        disabled: true,
        validate: makeValidator(requiredAlphanumericDashUnderscoreSpace),
        action: (inputValue) => ({ message: `Saved file: ${inputValue}`, shouldReset: true })
      }
    ],
    disableInputMatching: true,
    systemIntentions: [SystemIntentIds.CANCEL]
  }),
  group: 'Common'
};
