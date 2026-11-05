// `when` clauses: condition names (dotted paths to app functions, by convention `<app>.conditions.<name>`) combined
// with !, &&, || and parentheses. Logic only: a condition is a function that returns a boolean; anything that
// compares belongs inside one. Parsing reuses jsep (MIT), left unconfigured because its configuration is shared by
// every caller in the app; the tree it returns is checked here instead.

import jsep from 'jsep';

const LOGICAL = new Set(['&&', '||']);

// → (reading) => boolean. `resolve(path, owner)` returns the app's function for a dotted path, or throws naming it.
export function compileWhen(clause, { resolve, owner }) {
  const fail = (why) => {
    throw new Error(`${owner}: when "${clause}" ${why}`);
  };

  let tree;
  try {
    tree = jsep(clause);
  } catch (error) {
    fail(`isn't a valid clause (${error.message})`);
  }

  const pathOf = (node) => {
    if (node.type === 'Identifier') {
      return node.name;
    }
    if (node.type === 'MemberExpression' && !node.computed && node.property.type === 'Identifier') {
      return `${pathOf(node.object)}.${node.property.name}`;
    }
    return fail('may use only condition names, !, &&, || and parentheses');
  };

  function compile(node) {
    if (node.type === 'UnaryExpression' && node.operator === '!') {
      const inner = compile(node.argument);
      return (reading) => !inner(reading);
    }
    if (node.type === 'BinaryExpression' && LOGICAL.has(node.operator)) {
      const left = compile(node.left);
      const right = compile(node.right);
      return node.operator === '&&'
        ? (reading) => left(reading) && right(reading)
        : (reading) => left(reading) || right(reading);
    }
    const path = pathOf(node);
    const condition = resolve(path, owner);
    return (reading) => {
      const value = condition(reading);
      if (typeof value !== 'boolean') {
        throw new Error(
          `Condition "${path}" returned ${typeof value}; conditions return a boolean`
        );
      }
      return value;
    };
  }

  return compile(tree);
}
