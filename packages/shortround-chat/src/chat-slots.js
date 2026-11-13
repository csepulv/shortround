import { useShortRoundComponents } from '@shortround/react';

export const CHAT_SLOT_NAMES = [
  'Frame',
  'Transcript',
  'Message',
  'Text',
  'IntentionRun',
  'ToolRun',
  'Error',
  'Composer',
  'Row',
  'Input'
];

/** The theme's Chat slots from the nearest ShortRoundProvider; throws, naming what is missing, when there are none. */
export function useChatSlots() {
  const chat = useShortRoundComponents()?.Chat;
  if (!chat) {
    throw new Error(
      'IntentionChat: the theme has no components.Chat (or there is no ShortRoundProvider above it)'
    );
  }
  const missing = CHAT_SLOT_NAMES.filter((name) => !chat[name]);
  if (missing.length) {
    throw new Error(
      `IntentionChat: the theme has no ${missing.map((name) => `components.Chat.${name}`).join(' or ')}`
    );
  }
  return chat;
}
