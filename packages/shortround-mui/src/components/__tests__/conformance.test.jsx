// MUI's theme against the ShortRound theme contract (theme-provider M1; the theme object since M2).
import { describeThemeContract } from '@shortround/conformance';

import { muiTheme } from '../../mui-theme.js';

describeThemeContract('MUI', muiTheme);
