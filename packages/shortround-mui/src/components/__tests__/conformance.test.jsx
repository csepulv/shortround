// MUI's theme against the ShortRound theme contract (the theme object since 0.3.0).
import { describeThemeContract } from '@shortround/conformance';

import { muiTheme } from '../../mui-theme.js';

describeThemeContract('MUI', muiTheme);
