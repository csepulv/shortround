import { createSidekickStore } from '@shortround/core';
import { act, renderHook } from '@testing-library/react';

import { useSidekick } from '../useSidekick.js';

const PANEL = () => 'panel';

// The store's own sidecar tests are core's (packages/shortround-core/src/__tests__/sidekick-store.test.js); this one
// checks the hook's calls reach the store's reducer.
describe("useSidekick and the store's sidecar", () => {
  test("useSidekick's setSidecarRenderer and closeSidecar go through the reducer too", () => {
    const store = createSidekickStore();
    const reasons = [];
    store.setSidecarReducer((current, proposed, { reason }) => {
      reasons.push(reason);
      return proposed;
    });
    const { result } = renderHook(() => useSidekick({ store }));

    act(() => result.current.setSidecarRenderer(PANEL));
    act(() => result.current.closeSidecar());

    expect(reasons).toEqual(['app', 'app']);
  });
});
