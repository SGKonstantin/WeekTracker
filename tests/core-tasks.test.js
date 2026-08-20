import { beforeAll, describe, expect, test } from 'vitest';
import loader from './helpers/loadAppsScript.js';

const WEEK = '2026-08-10';

let normalizeTaskText_;
let calculateNextTaskPosition_;
let findTaskPositionSwap_;

beforeAll(() => {
  ({
    normalizeTaskText_,
    calculateNextTaskPosition_,
    findTaskPositionSwap_,
  } = loader.loadAppsScript());
});

function task(id, position, options = {}) {
  return {
    id,
    weekStart: options.weekStart ?? WEEK,
    day: options.day ?? 1,
    position,
    active: options.active ?? true,
    text: options.text ?? `Task ${id}`,
    done: options.done ?? false,
    category: options.category ?? 'Custom',
  };
}

describe('normalizeTaskText_', () => {
  test.each([
    ['  Task name  ', 'Task name'],
    ['', ''],
    [null, ''],
  ])('normalizes %j to %j', (input, expected) => {
    expect(normalizeTaskText_(input)).toBe(expected);
  });
});

describe('calculateNextTaskPosition_', () => {
  test('returns one for an empty task list', () => {
    expect(calculateNextTaskPosition_([], WEEK, 1)).toBe(1);
  });

  test('uses only active tasks from the requested week and day', () => {
    const tasks = [
      task('same-1', 2),
      task('same-2', 5),
      task('inactive', 20, { active: false }),
      task('other-day', 30, { day: 2 }),
      task('other-week', 40, { weekStart: '2026-08-17' }),
    ];

    expect(calculateNextTaskPosition_(tasks, WEEK, 1)).toBe(6);
  });

  test('treats the string false active flag as inactive', () => {
    const tasks = [task('active', 3), task('inactive', 9, { active: 'false' })];

    expect(calculateNextTaskPosition_(tasks, WEEK, 1)).toBe(4);
  });
});

describe('findTaskPositionSwap_', () => {
  test('selects the previous active task in the same week and day', () => {
    const tasks = [
      task('first', 10, { text: 'First', done: true }),
      task('inactive', 15, { active: false }),
      task('current', 20, { text: 'Current', category: 'Work' }),
      task('other-day', 18, { day: 2 }),
      task('other-week', 19, { weekStart: '2026-08-17' }),
    ];
    const snapshot = JSON.parse(JSON.stringify(tasks));

    const result = findTaskPositionSwap_(tasks, 'current', 'up');

    expect(result.currentId).toBe('current');
    expect(result.currentPosition).toBe(20);
    expect(result.targetId).toBe('first');
    expect(result.targetPosition).toBe(10);
    expect(tasks).toEqual(snapshot);
  });

  test('selects the next active task in the same week and day', () => {
    const tasks = [task('current', 1), task('inactive', 2, { active: false }), task('next', 3)];
    const result = findTaskPositionSwap_(tasks, 'current', 'down');

    expect(result.currentId).toBe('current');
    expect(result.currentPosition).toBe(1);
    expect(result.targetId).toBe('next');
    expect(result.targetPosition).toBe(3);
  });

  test.each([
    ['first task up', 'first', 'up'],
    ['last task down', 'last', 'down'],
    ['inactive task', 'inactive', 'up'],
    ['unknown task', 'missing', 'up'],
  ])('returns null for %s', (_scenario, id, direction) => {
    const tasks = [
      task('first', 1),
      task('inactive', 2, { active: false }),
      task('last', 3),
    ];

    expect(findTaskPositionSwap_(tasks, id, direction)).toBeNull();
  });
});
