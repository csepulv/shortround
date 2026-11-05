// "/" in a block opens ShortRound's command line. TipTap's suggestion utility brings the trigger, the keys and the
// popup's position; the command line reads the text after "/" and says what Tab and Enter do. When Enter runs a line,
// the "/…" text goes first, then the command's own function edits the document at the cursor.
import { Extension } from '@tiptap/core';
import { PluginKey } from '@tiptap/pm/state';
import { ReactRenderer } from '@tiptap/react';
import Suggestion, { exitSuggestion } from '@tiptap/suggestion';

import { SlashPopup } from './SlashPopup.jsx';

const SLASH_KEY = new PluginKey('slash');

export const makeSlashCommand = ({ commandLine }) =>
  Extension.create({
    name: 'slashCommand',
    addProseMirrorPlugins() {
      const { editor } = this;
      return [
        Suggestion({
          editor,
          pluginKey: SLASH_KEY,
          char: '/',
          allowSpaces: true,
          // The command line decides what the popup shows; the utility's own items aren't used.
          items: () => [],
          render: () => makeSlashSession({ editor, commandLine })
        })
      ];
    }
  });

// One "/…" from the popup opening to closing.
function makeSlashSession({ editor, commandLine }) {
  let latest;
  let popup;
  let unmount;
  let stopListening;
  let isSubmitting = false;

  const show = () => popup?.updateProps({ state: commandLine.getState() });

  // The query is the text after "/"; the caret is where the cursor sits within it.
  function follow(props) {
    latest = props;
    const caret = editor.state.selection.from - (props.range.from + 1);
    commandLine.change(props.query, Math.max(0, Math.min(caret, props.query.length)));
  }

  // After Tab, the command line's new text replaces the query, and the cursor goes where it says.
  function writeBack() {
    const from = latest.range.from + 1;
    const { text, caret } = commandLine.getState();
    editor
      .chain()
      .focus()
      .insertContentAt({ from, to: latest.range.to }, { type: 'text', text })
      .setTextSelection(from + caret)
      .run();
  }

  function onKeyDown({ event }) {
    if (event.key === 'Tab') {
      if (commandLine.acceptCompletion()) {
        writeBack();
      }
      return true;
    }
    if (event.key === 'Enter') {
      if (commandLine.getState().canRun) {
        // Removing the "/…" closes the popup (onExit) before the line runs, so the line isn't cleared there; submit()
        // clears it after the run.
        isSubmitting = true;
        editor.chain().focus().deleteRange(latest.range).run();
        commandLine.submit().finally(() => {
          isSubmitting = false;
        });
      } else if (commandLine.acceptCompletion()) {
        writeBack();
      }
      return true;
    }
    if (event.key === 'Escape') {
      exitSuggestion(editor.view, SLASH_KEY);
      return true;
    }
    return false;
  }

  return {
    onStart(props) {
      follow(props);
      popup = new ReactRenderer(SlashPopup, {
        editor,
        props: { state: commandLine.getState() }
      });
      unmount = props.mount(popup.element);
      stopListening = commandLine.subscribe(show);
    },
    onUpdate: follow,
    onKeyDown,
    onExit() {
      stopListening?.();
      unmount?.();
      popup?.destroy();
      popup = undefined;
      if (!isSubmitting) {
        commandLine.cancel();
      }
    }
  };
}
