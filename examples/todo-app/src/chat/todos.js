import { buildCatalogRuntime, loadCatalog } from '@shortround/core';

export const TODO_CATALOG = `
version: 3
app: todos
groups:
  todos: { label: Todos }
  view: { label: View }
states:
  listing: { start: true, commands: [markDone, reopen, show] }
commands:
  markDone:
    label: Mark done
    group: todos
    when: todos.hasOpen
    run: todos.markDone
    params:
      todo: { label: Todo, default: true, argSource: { lookup: todos.openRows } }
  reopen:
    label: Reopen
    group: todos
    when: todos.hasDone
    run: todos.reopen
    params:
      todo: { label: Todo, default: true, argSource: { lookup: todos.doneRows } }
  show:
    label: Show
    group: view
    run: todos.show
    params:
      filter:
        label: Filter
        default: true
        argSource:
          list:
            - { value: open, title: open }
            - { value: done, title: done }
            - { value: all, title: all }
`;

const FIXED_TODOS = [
  { id: 'milk', title: 'Buy milk' },
  { id: 'eggs', title: 'Buy eggs' },
  { id: 'bread', title: 'Buy bread' },
  { id: 'plumber', title: 'Call the plumber' },
  { id: 'passport', title: 'Renew passport' },
  { id: 'dentist', title: 'Book the dentist' }
];

const FILTERS = {
  all: () => true,
  open: (todo) => !todo.isDone,
  done: (todo) => todo.isDone
};

function makeTodoStore() {
  let state = { todos: FIXED_TODOS.map((todo) => ({ ...todo, isDone: false })), filter: 'all' };
  const listeners = new Set();
  const update = (change) => {
    state = { ...state, ...change(state) };
    listeners.forEach((listener) => listener());
  };
  const titleOf = (id) => state.todos.find((todo) => todo.id === id)?.title ?? id;
  const setDone = (id, isDone) =>
    update(({ todos }) => ({
      todos: todos.map((todo) => (todo.id === id ? { ...todo, isDone } : todo))
    }));
  return {
    getState: () => state,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    visibleTodos: () => state.todos.filter(FILTERS[state.filter]),
    titleOf,
    markDone: (id) => setDone(id, true),
    reopen: (id) => setDone(id, false),
    show: (filter) => update(() => ({ filter }))
  };
}

const rowsOf = (todos) => todos.map(({ id, title }) => ({ value: id, title }));

function makeBindings(store) {
  const todosWhere = (isDone) => store.getState().todos.filter((todo) => todo.isDone === isDone);
  return {
    todos: {
      hasOpen: () => todosWhere(false).length > 0,
      hasDone: () => todosWhere(true).length > 0,
      openRows: () => rowsOf(todosWhere(false)),
      doneRows: () => rowsOf(todosWhere(true)),
      markDone: ({ todo }) => {
        store.markDone(todo);
        return { message: `Marked "${store.titleOf(todo)}" done` };
      },
      reopen: ({ todo }) => {
        store.reopen(todo);
        return { message: `Reopened "${store.titleOf(todo)}"` };
      },
      show: ({ filter }) => {
        store.show(filter);
        return { message: `Showing ${filter} todos` };
      }
    }
  };
}

/** The todo list and its catalog runtime: every change to the list tells the runtime, so the chat follows it. */
export function makeTodos() {
  const store = makeTodoStore();
  const runtime = buildCatalogRuntime(loadCatalog(TODO_CATALOG, makeBindings(store)));
  store.subscribe(() => runtime.notify());
  return { store, runtime };
}
