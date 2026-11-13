import { act, fireEvent, screen } from '@testing-library/react';

export class ContractError extends Error {}

export function expectThat(condition, message) {
  if (!condition) {
    throw new ContractError(message);
  }
}

// A check: its failures carry its id, so a theme author (and the suite's own tests) can tell a contract failure from an
// unrelated crash. `group` is the slot group it needs: 'palette', 'chat', or 'toast' (every theme).
export const defineCheck = ({ id, group, slots, obligation, verify }) => ({
  id,
  group,
  slots,
  obligation,
  run: async (theme) => {
    try {
      await verify(theme);
    } catch (error) {
      if (error instanceof ContractError) {
        error.checkId = id;
      }
      throw error;
    }
  }
});

// cmdk and the chat need these browser APIs; jsdom lacks them.
export function installJsdomShims() {
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
  Element.prototype.scrollIntoView ??= () => {};
}

export function findByHook(testId, slot) {
  const elements = screen.queryAllByTestId(testId);
  expectThat(elements.length > 0, `${slot}: no element with data-testid="${testId}"`);
  expectThat(elements.length === 1, `${slot}: more than one element with data-testid="${testId}"`);
  return elements[0];
}

// Choosing an intention runs it asynchronously; letting it settle inside act() keeps React's updates where React
// expects them (no "not configured to support act" warnings in a theme's test output).
const settle = () => new Promise((resolve) => setTimeout(resolve, 0));
export const actAndSettle = (doSomething) =>
  act(async () => {
    doSomething();
    await settle();
  });

export const typeInto = (input, text) =>
  actAndSettle(() =>
    fireEvent.change(input, { target: { value: text, selectionStart: text.length } })
  );
export const click = (element) => actAndSettle(() => element.click());
export const pressKey = (element, key, modifiers = {}) =>
  actAndSettle(() => fireEvent.keyDown(element, { key, ...modifiers }));
