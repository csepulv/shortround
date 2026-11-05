import { useState } from 'react';

import { NotesEditor } from './NotesEditor.jsx';

export function App() {
  const [runs, setRuns] = useState([]);
  return (
    <main>
      <h1>Slash commands, read by ShortRound</h1>
      <NotesEditor log={(line) => setRuns((all) => [...all, line])} />
      <h2>Runs</h2>
      <ol data-testid="runs">
        {runs.map((run, index) => (
          <li key={index}>{run}</li>
        ))}
      </ol>
    </main>
  );
}
