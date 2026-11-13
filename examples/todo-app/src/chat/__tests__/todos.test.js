import { describe, expect, test } from 'vitest';

import { makeTodos } from '../todos.js';

const titlesOf = (todos) => todos.map((todo) => todo.title);

describe('the todo list', () => {
  test('starts with its fixed todos, all open, showing every one', () => {
    const { store } = makeTodos();

    expect(store.getState().filter).toBe('all');
    expect(store.visibleTodos().every((todo) => !todo.isDone)).toBe(true);
    expect(store.visibleTodos().length).toBeGreaterThan(3);
  });

  test('a typed "mark done" marks that todo done, and says so', async () => {
    const { store, runtime } = makeTodos();
    const line = runtime.commandLine();

    line.change('mark done buy milk');
    const outcome = await line.submit();

    expect(outcome.message).toBe('Marked "Buy milk" done');
    expect(store.getState().todos.find((todo) => todo.title === 'Buy milk').isDone).toBe(true);
  });

  test('reopen is offered only while a todo is done, and offers only the done ones', async () => {
    const { runtime } = makeTodos();
    const before = runtime.isAvailable('reopen');

    await runtime.run('markDone', { todo: 'milk' });
    const tools = await runtime.tools();
    const reopen = tools.find((tool) => tool.name === 'reopen');

    expect(before).toBe(false);
    expect(runtime.isAvailable('reopen')).toBe(true);
    expect(reopen.inputSchema.properties.todo.description).toContain('"Buy milk"');
    expect(reopen.inputSchema.properties.todo.description).not.toContain('"Buy eggs"');
  });

  test('show filters the list to the open or the done todos', async () => {
    const { store, runtime } = makeTodos();
    await runtime.run('markDone', { todo: 'milk' });

    await runtime.run('show', { filter: 'done' });
    const done = titlesOf(store.visibleTodos());
    await runtime.run('show', { filter: 'open' });
    const open = titlesOf(store.visibleTodos());

    expect(done).toEqual(['Buy milk']);
    expect(open).not.toContain('Buy milk');
  });

  test('a line typed before a change follows it: "reopen" starts a command once a todo is done', async () => {
    const { runtime } = makeTodos();
    const line = runtime.commandLine();
    line.change('reopen');
    const roleOf = () => line.getState().roles[0]?.role;
    const before = roleOf();

    await runtime.run('markDone', { todo: 'milk' });

    expect(before).toBe('broken');
    expect(roleOf()).toBe('verb');
  });

  test('a subscriber hears each change', async () => {
    const { store, runtime } = makeTodos();
    let heard = 0;
    store.subscribe(() => {
      heard += 1;
    });

    await runtime.run('markDone', { todo: 'eggs' });

    expect(heard).toBe(1);
  });
});
