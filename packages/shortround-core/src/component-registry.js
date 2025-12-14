/**
 * Component Registry for ShortRound
 *
 * This module provides a registry pattern for UI component injection.
 * UI implementations (MUI, Shadcn, etc.) register their components once at startup,
 * and core components import from here as if they were regular React components.
 *
 * Usage:
 *   // At app startup
 *   import { configureComponents } from '@shortround/core';
 *   import { MuiComponents } from '@shortround/mui';
 *   configureComponents(MuiComponents);
 *
 *   // In core components
 *   import { SidekickFrame, IntentionInput } from './component-registry';
 */

const registry = {};

/**
 * Configure the UI components to use throughout ShortRound.
 * Must be called before rendering any ShortRound components.
 *
 * @param {Object} components - Object containing component implementations
 * @param {React.Component} components.IntentionItem - Intention list item component
 * @param {React.Component} components.IntentionNoMatches - No matches message component
 * @param {React.Component} components.IntentionInput - Command input component
 * @param {React.Component} components.IntentionGroup - Group header component
 * @param {React.Component} components.IntentionPaletteFrame - Palette container component
 * @param {React.Component} components.SidekickControlBar - Control bar component
 * @param {React.Component} components.SidekickFrame - Main frame component
 * @param {React.Component} components.SidekickPopover - Popover container component
 * @param {React.Component} components.SidecarContent - Sidecar content wrapper component
 */
export function configureComponents(components) {
  Object.assign(registry, components);
}

/**
 * Get the current registry (useful for debugging)
 */
export function getRegistry() {
  return { ...registry };
}

/**
 * Check if components have been configured
 */
export function isConfigured() {
  return Object.keys(registry).length > 0;
}

// Helper to create wrapper components with helpful error messages
function createWrapper(name) {
  return function RegistryWrapper(props) {
    const Component = registry[name];
    if (!Component) {
      throw new Error(
        `ShortRound: ${name} component not configured. ` +
          `Call configureComponents() before rendering ShortRound components.`
      );
    }
    return <Component {...props} />;
  };
}

// Intention Palette Components
export const IntentionItem = createWrapper('IntentionItem');
export const IntentionNoMatches = createWrapper('IntentionNoMatches');
export const IntentionInput = createWrapper('IntentionInput');
export const IntentionGroup = createWrapper('IntentionGroup');
export const IntentionPaletteFrame = createWrapper('IntentionPaletteFrame');

// Sidekick Components
export const SidekickControlBar = createWrapper('SidekickControlBar');
export const SidekickFrame = createWrapper('SidekickFrame');
export const SidekickPopover = createWrapper('SidekickPopover');

// Sidecar Components
export const SidecarContent = createWrapper('SidecarContent');

