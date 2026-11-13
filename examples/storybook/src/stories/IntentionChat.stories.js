import IntentionChatExample from './mui/IntentionChatExample';

// The MUI chat over a catalog, with a scripted model: type "search grid with" (what is missing reads in italics), "preview
// 2", or send "preview the CSS grid guide" with Cmd/Ctrl+Enter.
export default {
  title: 'Example/Intention chat',
  component: IntentionChatExample,
  parameters: { layout: 'centered' }
};

export const WithHintForMissing = {
  args: { showHintForMissing: true }
};

export const WithoutHintForMissing = {
  args: { showHintForMissing: false }
};
