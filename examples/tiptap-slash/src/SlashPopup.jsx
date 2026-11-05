// The slash popup: the line as it is being read (each word coloured by its role, the ghost after it), what it would
// run, and the next steps. It only draws the command line's state.
export function SlashPopup({ state }) {
  return (
    <div className="slash-popup" data-testid="slash-popup">
      <div className="slash-line">
        /<LineWords state={state} />
      </div>
      <div className="slash-status" data-testid="slash-status">
        {statusOf(state) || ' '}
      </div>
      <ul className="slash-steps">
        {state.nextSteps.slice(0, 6).map((step) => (
          <li key={step.insertText}>
            {step.label} <span className="slash-kind">{step.kind}</span>
          </li>
        ))}
      </ul>
      <div className="slash-keys">Tab completes · Enter runs · Esc closes</div>
    </div>
  );
}

const statusOf = (state) =>
  [
    ...state.loading.map(({ label }) => `Loading ${label.toLowerCase()}…`),
    ...(state.problem ? [state.problem] : []),
    ...state.incomplete,
    ...(state.top ? [`Runs: ${state.top.title}${state.canRun ? '' : ' (not yet)'}`] : [])
  ].join(' · ');

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
