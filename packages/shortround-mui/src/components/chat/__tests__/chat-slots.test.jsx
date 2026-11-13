import { fireEvent, render, screen } from '@testing-library/react';

import { MuiChatComponents as Chat } from '../index.js';

const row = (overrides = {}) => ({
  id: 'command:Preview',
  title: 'Preview',
  group: 'Results',
  ...overrides
});

test('the frame draws its children, and colours the typed line by role', () => {
  const { container } = render(
    <Chat.Frame>
      <span data-role="verb">search</span>
      <span data-role="text">grid</span>
    </Chat.Frame>
  );
  const colourOf = (role) =>
    window.getComputedStyle(container.querySelector(`[data-role="${role}"]`)).color;

  expect(container).toHaveTextContent('searchgrid');
  expect(colourOf('verb')).toBe('rgb(25, 118, 210)');
});

test('a message draws its parts: text, a typed run, a tool run, an error', () => {
  render(
    <Chat.Transcript>
      <Chat.Message role="user">
        <Chat.Text role="user">preview the guide</Chat.Text>
      </Chat.Message>
      <Chat.Message role="assistant">
        <Chat.Text role="assistant">
          <strong>Opened</strong>
        </Chat.Text>
        <Chat.IntentionRun line="search grid" message="Searched for grid" />
        <Chat.ToolRun
          input={{ result: '2' }}
          label="Preview"
          name="preview"
          output="Previewing 2"
          state="done"
        />
      </Chat.Message>
      <Chat.Error message="The request failed" />
    </Chat.Transcript>
  );

  expect(screen.getByText('preview the guide')).toBeInTheDocument();
  expect(screen.getByText('Opened').tagName).toBe('STRONG');
  expect(screen.getByText('search grid')).toBeInTheDocument();
  expect(screen.getByText('Searched for grid')).toBeInTheDocument();
  expect(screen.getByText('Preview {"result":"2"}')).toBeInTheDocument();
  expect(screen.getByText('Previewing 2')).toBeInTheDocument();
  expect(screen.getByText('The request failed')).toBeInTheDocument();
});

test.each([
  ['running', {}, 'Running…'],
  ['done', { output: 'Closed the preview' }, 'Closed the preview'],
  ['refused', { errorText: '"next" is not available now' }, 'Refused: "next" is not available now']
])('a tool run that is %s says so', (state, answer, text) => {
  render(<Chat.ToolRun input={{}} label="Next" name="next" state={state} {...answer} />);

  expect(screen.getByText(text)).toBeInTheDocument();
});

test('an assistant text with no children draws an empty part', () => {
  const { container } = render(<Chat.Text role="assistant" />);

  expect(container).toHaveTextContent('');
  expect(container.firstChild).not.toBeNull();
});

test('a tool run with no input draws empty braces', () => {
  render(<Chat.ToolRun label="Close preview" name="closePreview" state="running" />);

  expect(screen.getByText('Close preview {}')).toBeInTheDocument();
});

test("a tool run whose answer is the run's output draws it as JSON", () => {
  render(<Chat.ToolRun label="Find notes" name="findNotes" output={{ total: 2 }} state="done" />);

  expect(screen.getByText('{"total":2}')).toBeInTheDocument();
});

test('the composer places the rows above the input, and only the input when there are none', () => {
  const { rerender } = render(
    <Chat.Composer input={<textarea data-testid="input" />} rows={<li>a row</li>} />
  );
  const rowsThenInput = screen
    .getByText('a row')
    .compareDocumentPosition(screen.getByTestId('input'));
  expect(rowsThenInput & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();

  rerender(<Chat.Composer input={<textarea data-testid="input" />} rows={null} />);
  expect(screen.queryByRole('listbox')).toBeNull();
  expect(screen.getByTestId('input')).toBeInTheDocument();
});

test('the input slot places the input', () => {
  render(<Chat.Input input={<textarea data-testid="shortround-chat-input" />} />);

  expect(screen.getByTestId('shortround-chat-input')).toBeInTheDocument();
});

describe('a row', () => {
  const renderRow = (props) =>
    render(
      <ul>
        <Chat.Row isHighlighted={false} onChoose={() => {}} row={row()} {...props} />
      </ul>
    );

  test('shows its title and subtitle, and a click chooses it', () => {
    const onChoose = vi.fn();
    renderRow({ onChoose, row: row({ subtitle: 'Needs Result' }) });

    fireEvent.click(screen.getByText('Preview'));

    expect(screen.getByText('Needs Result')).toBeInTheDocument();
    expect(onChoose).toHaveBeenCalledTimes(1);
  });

  test('a disabled row is not chosen by a click', () => {
    const onChoose = vi.fn();
    renderRow({ onChoose, row: row({ disabled: true }) });

    fireEvent.click(screen.getByText('Preview'));

    expect(onChoose).not.toHaveBeenCalled();
  });

  test('a click keeps the focus where it is', () => {
    renderRow();

    const isDefaultKept = fireEvent.mouseDown(screen.getByText('Preview'));

    expect(isDefaultKept).toBe(false);
  });

  test('the highlighted row is marked selected, without needing scrollIntoView', () => {
    expect(Element.prototype.scrollIntoView).toBeUndefined();
    renderRow({ isHighlighted: true });

    expect(screen.getByRole('option')).toHaveAttribute('aria-selected', 'true');
  });

  test('a row that becomes highlighted scrolls into view', () => {
    const scrollIntoView = vi.fn();
    Element.prototype.scrollIntoView = scrollIntoView;
    try {
      const { rerender } = renderRow();
      expect(scrollIntoView).not.toHaveBeenCalled();

      rerender(
        <ul>
          <Chat.Row isHighlighted onChoose={() => {}} row={row()} />
        </ul>
      );

      expect(scrollIntoView).toHaveBeenCalledWith({ block: 'nearest' });
    } finally {
      delete Element.prototype.scrollIntoView;
    }
  });

  test('the option is the only control: no button inside it, and a disabled row says so on the option', () => {
    renderRow({ row: row({ disabled: true }) });

    const option = screen.getByRole('option');
    expect(option.querySelector('[role="button"]')).toBeNull();
    expect(option).toHaveAttribute('aria-disabled', 'true');
  });

  test('a row that says what is missing is drawn in italics', () => {
    renderRow({ row: row({ subtitle: 'Missing result', missing: ['Result'], disabled: true }) });

    expect(window.getComputedStyle(screen.getByText('Missing result')).fontStyle).toBe('italic');
  });
});
