import {
  ArrowLeft,
  BellRing,
  Code,
  FileText,
  Folder,
  // The older name of CircleHelp, still exported, so the peer range (lucide-react >=0.300) keeps working.
  HelpCircle,
  Home,
  LayoutDashboard,
  Palette,
  Search,
  Settings,
  User,
  X
} from 'lucide-react';

// The row's icon space sets the colour (lucide draws in currentColor); the icon sets only its size.
export const ICON_SIZE = 18;

const drawn = (LucideIcon) => {
  const MuiIcon = () => <LucideIcon size={ICON_SIZE} />;
  MuiIcon.displayName = `Mui${LucideIcon.displayName}`;
  return MuiIcon;
};

// MUI's icons by name: what a row shows when the app gives none of its own. `unknown` is the placeholder for a name
// nothing knows; `back` and `cancel` are ShortRound's own Back and Cancel.
export const MUI_ICONS = {
  search: drawn(Search),
  settings: drawn(Settings),
  home: drawn(Home),
  person: drawn(User),
  folder: drawn(Folder),
  file: drawn(FileText),
  code: drawn(Code),
  palette: drawn(Palette),
  dashboard: drawn(LayoutDashboard),
  notification: drawn(BellRing),
  back: drawn(ArrowLeft),
  cancel: drawn(X),
  unknown: drawn(HelpCircle)
};
