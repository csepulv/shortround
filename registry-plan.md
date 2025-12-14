# Component Registry Pattern - Implementation Plan

## Goal

Replace prop-based component injection (`SidekickComponents` prop) with a registry pattern where core components import from a central registry module. This gives us the clean import syntax:

```javascript
import { SidekickFrame, IntentionInput } from './component-registry';
```

Instead of threading `SidekickComponents` through the component tree.

---

## Pattern Overview

### The Registry Module

```javascript
// component-registry.js
const registry = {};

export function configureComponents(components) {
  Object.assign(registry, components);
}

// Wrapper components that delegate to registered implementations
export function SidekickFrame(props) {
  const Impl = registry.SidekickFrame;
  if (!Impl) throw new Error('SidekickFrame not configured');
  return <Impl {...props} />;
}

// ... repeat for each component slot
```

### Consumer Configuration

```javascript
// At app startup (before any ShortRound components render)
import { configureComponents } from '@shortround/core';
import { MuiComponents } from '@shortround/mui';

configureComponents(MuiComponents);
```

### Core Component Usage

```javascript
// Inside shortround-core - looks like regular imports
import { SidekickFrame, IntentionInput } from './component-registry';

export function MyComponent() {
  return (
    <SidekickFrame>
      <IntentionInput />
    </SidekickFrame>
  );
}
```

---

## Components to Register

Based on current `MuiSidekickComponents` structure:

| Registry Key | Current Path | Description |
|--------------|--------------|-------------|
| `IntentionItem` | `IntentionPalette.Item` | List item for an intention |
| `IntentionNoMatches` | `IntentionPalette.NoMatches` | Empty state message |
| `IntentionInput` | `IntentionPalette.Input` | Command input field |
| `IntentionGroup` | `IntentionPalette.Group` | Group header |
| `IntentionPaletteFrame` | `IntentionPalette.Frame` | Palette container |
| `SidekickControlBar` | `Sidekick.ControlBar` | Top control bar |
| `SidekickFrame` | `Sidekick.Frame` | Main frame wrapper |
| `SidekickPopover` | `Sidekick.Popover` | Popover container |
| `SidecarContent` | `SidecarContent` | Sidecar content wrapper |

---

## Files to Create/Modify

### New File: `packages/shortround-core/src/component-registry.js`

- Registry object holding component references
- `configureComponents(components)` function
- `getRegistry()` for debugging
- `isConfigured()` helper
- Wrapper components for each slot (9 total)

### Modify: `packages/shortround-core/src/components/ShortRoundSidekick.jsx`

- Remove `SidekickComponents` prop
- Import `SidekickPopover`, `SidecarContent` from registry

### Modify: `packages/shortround-core/src/components/ShortRoundPaletteFrame.jsx`

- Remove `SidekickComponents` prop destructuring
- Import `SidekickFrame`, `SidekickControlBar` from registry

### Modify: `packages/shortround-core/src/components/ShortRoundPalette.jsx`

- Remove `IntentionPalette` prop
- Import all intention components from registry

### Modify: `packages/shortround-core/src/index.js`

- Export `configureComponents`, `isConfigured` from registry

### Modify: `packages/shortround-mui/src/MuiSidekickComponents.js`

- Export flat object with registry-compatible keys:

```javascript
export const MuiComponents = {
  IntentionItem,
  IntentionNoMatches: NoMatches,
  IntentionInput,
  IntentionGroup,
  IntentionPaletteFrame,
  SidekickControlBar,
  SidekickFrame,
  SidekickPopover,
  SidecarContent
};
```

### Modify: `packages/shortround-shadcn-ui/src/...`

- Create equivalent flat export (or defer if not currently complete)

### Modify: `examples/todo-app/src/MuiApp.jsx`

- Add `configureComponents(MuiComponents)` call before render
- Remove `SidekickComponents` prop from `<ShortRoundSidekick>`

---

## Migration Notes

### Backward Compatibility

Could keep `SidekickComponents` prop as optional override:

```javascript
function ShortRoundPaletteFrame({ SidekickComponents: propsComponents }) {
  // Props override registry if provided
  const Frame = propsComponents?.Sidekick?.Frame || SidekickFrame;
  // ...
}
```

Decision: Start without backward compat, clean break.

### Error Handling

- Throw helpful errors if `configureComponents()` not called
- Include component name in error message
- Consider dev-mode warnings

### Testing Considerations

- Tests need to call `configureComponents()` in setup
- Or: provide mock components for testing
- Could add `resetRegistry()` for test cleanup

---

## Trade-offs

### Pros

- Clean import syntax in core (no prop drilling)
- Configure once at app startup
- Encapsulates UI library choice
- Core code reads naturally

### Cons

- Global mutable state (the registry)
- Must configure before render (ordering matters)
- Less explicit than props (harder to trace)
- Not tree-shakeable (all wrappers bundled)

### Alternatives Considered

1. **React Context** - More "React-y" but still requires provider/consumer pattern
2. **Build-time aliases** - True static imports, but no runtime switching
3. **Proxy object** - Less boilerplate but more magic

---

## Implementation Order

1. Create `component-registry.js` with all wrappers
2. Update core components to use registry imports
3. Update MUI package to export flat components object
4. Update examples to use `configureComponents()`
5. Update exports in `index.js`
6. Test end-to-end
7. Update Shadcn package (if applicable)

---

## Open Questions

- Should we support runtime switching (unlikely need, but possible)?
- Do we need backward compat with `SidekickComponents` prop?
- How to handle SSR / multiple React roots?
- Should we validate component shape in `configureComponents()`?

