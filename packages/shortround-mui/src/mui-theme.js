import { MuiToast } from './components/Toast.jsx';
import { MuiSidekickComponents } from './MuiSidekickComponents.js';

// The theme an app hands to ShortRoundProvider, once, at its root.
export const muiTheme = { components: MuiSidekickComponents, Toast: MuiToast };
