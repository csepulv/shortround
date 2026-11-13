import { ChatComposer, ChatFrame, ChatInput, ChatRow } from './ChatComposerSlots.jsx';
import {
  ChatError,
  ChatIntentionRun,
  ChatMessage,
  ChatText,
  ChatToolRun,
  ChatTranscript
} from './ChatTranscriptSlots.jsx';

export const MuiChatComponents = {
  Frame: ChatFrame,
  Transcript: ChatTranscript,
  Message: ChatMessage,
  Text: ChatText,
  IntentionRun: ChatIntentionRun,
  ToolRun: ChatToolRun,
  Error: ChatError,
  Composer: ChatComposer,
  Row: ChatRow,
  Input: ChatInput
};
