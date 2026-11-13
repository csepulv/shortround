import { useLayoutEffect, useRef } from 'react';

// The text properties the shadow copies from the input, so its words sit exactly under the typed ones whatever the
// theme does with `[cmdk-input]`.
const COPIED_STYLES = [
  'fontFamily',
  'fontSize',
  'fontWeight',
  'fontStyle',
  'lineHeight',
  'letterSpacing',
  'textIndent',
  'paddingTop',
  'paddingRight',
  'paddingBottom',
  'paddingLeft',
  'borderTopWidth',
  'borderRightWidth',
  'borderBottomWidth',
  'borderLeftWidth'
];

// An input (the palette's, or a host's own) with the line drawn under it: each word with its role (`data-role`, for
// a theme to colour) and the ghost after the last word. The real input stays on top, its text made transparent, so
// typing, the caret and selection stay native. Without `lineState` (in a step), the input shows as it always has.
export function LineInput({ children, inputRef, lineState }) {
  const shadowRef = useRef(null);
  const isShowing = Boolean(lineState);

  useLayoutEffect(() => {
    const input = inputRef.current;
    const shadow = shadowRef.current;
    if (!input) {
      return;
    }
    if (!isShowing) {
      input.style.color = '';
      input.style.caretColor = '';
      return;
    }
    copyBoxAndText(input, shadow);
    // A line longer than the input scrolls inside it; the shadow scrolls with it.
    const followScroll = () => {
      shadow.scrollLeft = input.scrollLeft;
    };
    followScroll();
    input.addEventListener('scroll', followScroll);
    return () => input.removeEventListener('scroll', followScroll);
  });

  return (
    <div data-testid="shortround-line-input" style={WRAPPER_STYLE}>
      {isShowing && (
        <div aria-hidden data-testid="shortround-line-shadow" ref={shadowRef} style={SHADOW_STYLE}>
          <LineWords state={lineState} />
        </div>
      )}
      {children}
    </div>
  );
}

// The wrapper takes the input's place in the theme's layout: in a row beside an icon (MUI), it stretches as the input
// did.
const WRAPPER_STYLE = { position: 'relative', flex: '1 1 auto', width: '100%', minWidth: 0 };

const SHADOW_STYLE = {
  position: 'absolute',
  pointerEvents: 'none',
  whiteSpace: 'pre',
  overflow: 'hidden',
  borderStyle: 'solid',
  borderColor: 'transparent',
  // The shadow is sized from the input's offset box, which includes padding and border.
  boxSizing: 'border-box'
};

// The shadow takes the input's place and text style; the input's own text turns transparent, its caret keeping the
// colour the text had.
function copyBoxAndText(input, shadow) {
  const computed = window.getComputedStyle(input);
  if (input.style.color !== 'transparent') {
    shadow.style.color = computed.color;
    input.style.caretColor = computed.color;
    input.style.color = 'transparent';
  }
  COPIED_STYLES.forEach((name) => {
    shadow.style[name] = computed[name];
  });
  Object.assign(shadow.style, {
    left: `${input.offsetLeft}px`,
    top: `${input.offsetTop}px`,
    width: `${input.offsetWidth}px`,
    height: `${input.offsetHeight}px`
  });
}

// The words as the engine read them, the spaces between kept, then the ghost.
function LineWords({ state }) {
  const pieces = [];
  let at = 0;
  for (const word of state.roles) {
    if (word.start > at) {
      pieces.push(<span key={`gap-${at}`}>{state.text.slice(at, word.start)}</span>);
    }
    pieces.push(
      <span data-role={word.role} key={word.start} title={word.reason}>
        {state.text.slice(word.start, word.end)}
      </span>
    );
    at = word.end;
  }
  if (at < state.text.length) {
    pieces.push(<span key={`tail-${at}`}>{state.text.slice(at)}</span>);
  }
  return (
    <>
      {pieces}
      {state.ghost && <span data-role="ghost">{state.ghost}</span>}
    </>
  );
}
