import { resolveIcon } from '../icons.js';
import { RevertIntentionIds } from '../utils.js';

const AppIcon = () => null;
const SpecialIcon = () => null;
const ThemeSearch = () => null;
const ThemeBack = () => null;
const ThemeUnknown = () => null;

const themeIcons = { search: ThemeSearch, back: ThemeBack, unknown: ThemeUnknown };
const row = (fields) => ({ id: 'row', title: 'Row', action: () => {}, ...fields });

describe('resolveIcon', () => {
  test("an intention's own override wins, even over Icon", () => {
    const icon = resolveIcon(row({ id: 'send', icon: 'chat' }), {
      registry: { Icon: AppIcon, intentions: { send: SpecialIcon } },
      themeIcons
    });

    expect(icon.type).toBe(SpecialIcon);
  });

  test('an override applies to an intention with no icon name', () => {
    const icon = resolveIcon(row({ id: 'send' }), {
      registry: { intentions: { send: SpecialIcon } },
      themeIcons
    });

    expect(icon.type).toBe(SpecialIcon);
  });

  test('an intention with no icon name has none', () => {
    expect(resolveIcon(row(), { registry: { Icon: AppIcon }, themeIcons })).toBeUndefined();
  });

  test("Back and Cancel use the theme's icons, not the app's Icon", () => {
    const back = { id: RevertIntentionIds.BACK, title: 'Back', icon: 'back' };
    const cancel = { id: RevertIntentionIds.RESET, title: 'Cancel', icon: 'cancel' };
    const sources = { registry: { Icon: AppIcon, names: { back: 'arrow_back' } }, themeIcons };

    expect(resolveIcon(back, sources).type).toBe(ThemeBack);
    expect(resolveIcon(cancel, sources).type).toBe(ThemeUnknown);
  });

  test('Back can be overridden by its id', () => {
    const back = { id: RevertIntentionIds.BACK, title: 'Back', icon: 'back' };

    const icon = resolveIcon(back, {
      registry: { intentions: { [RevertIntentionIds.BACK]: SpecialIcon } },
      themeIcons
    });

    expect(icon.type).toBe(SpecialIcon);
  });

  test("the app's Icon draws the name, after names maps it", () => {
    const icon = resolveIcon(row({ icon: 'chat' }), {
      registry: { Icon: AppIcon, names: { chat: 'forum' } },
      themeIcons
    });

    expect(icon.type).toBe(AppIcon);
    expect(icon.props).toEqual({ name: 'forum' });
  });

  test("the app's Icon draws a name names doesn't list, as it is", () => {
    const icon = resolveIcon(row({ icon: 'search' }), {
      registry: { Icon: AppIcon, names: { chat: 'forum' } },
      themeIcons
    });

    expect(icon.props).toEqual({ name: 'search' });
  });

  test("with Icon, a name the theme doesn't know is still Icon's, not the placeholder", () => {
    const icon = resolveIcon(row({ icon: 'nonsense' }), {
      registry: { Icon: AppIcon },
      themeIcons
    });

    expect(icon.type).toBe(AppIcon);
  });

  test("without Icon, the theme's icon for the name, after names maps it", () => {
    expect(resolveIcon(row({ icon: 'search' }), { themeIcons }).type).toBe(ThemeSearch);
    expect(
      resolveIcon(row({ icon: 'find' }), { registry: { names: { find: 'search' } }, themeIcons })
        .type
    ).toBe(ThemeSearch);
  });

  test("a name the theme doesn't know shows the theme's placeholder", () => {
    expect(resolveIcon(row({ icon: 'nonsense' }), { themeIcons }).type).toBe(ThemeUnknown);
  });

  test('with no placeholder in the theme, an unknown name shows none', () => {
    expect(
      resolveIcon(row({ icon: 'nonsense' }), { themeIcons: { search: ThemeSearch } })
    ).toBeUndefined();
  });

  test('with no registry and no theme icons, nothing', () => {
    expect(resolveIcon(row({ icon: 'search' }), {})).toBeUndefined();
  });
});
