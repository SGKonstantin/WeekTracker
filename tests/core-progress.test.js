import { beforeAll, describe, expect, test } from 'vitest';
import loader from './helpers/loadAppsScript.js';

let calculateProgress_;
let calculateTaskProgress_;
let calculateHabitProgress_;
let calculateWeekTaskProgress_;
let calculateHabitSummary_;

beforeAll(() => {
  ({
    calculateProgress_,
    calculateTaskProgress_,
    calculateHabitProgress_,
    calculateWeekTaskProgress_,
    calculateHabitSummary_,
  } = loader.loadAppsScript());
});

describe('calculateProgress_', () => {
  test.each([
    [0, 0, 0],
    [1, 1, 100],
    [1, 2, 50],
    [2, 3, 67],
    [3, 7, 43],
  ])('%i of %i -> %i%%', (completed, total, expected) => {
    expect(calculateProgress_(completed, total)).toBe(expected);
  });
});

describe('calculateTaskProgress_', () => {
  test('counts completed and total tasks', () => {
    const result = calculateTaskProgress_([
      { done: true },
      { done: false },
      { done: true },
    ]);

    expect(result.completed).toBe(2);
    expect(result.total).toBe(3);
    expect(result.progress).toBe(67);
  });

  test('returns zero progress for no tasks', () => {
    const result = calculateTaskProgress_([]);

    expect(result.completed).toBe(0);
    expect(result.total).toBe(0);
    expect(result.progress).toBe(0);
  });
});

describe('calculateHabitProgress_', () => {
  test('counts only scheduled values as required', () => {
    const result = calculateHabitProgress_([true, null, false, null, true]);

    expect(result.required).toBe(3);
    expect(result.completed).toBe(2);
    expect(result.progress).toBe(67);
  });

  test('returns zero progress when nothing is scheduled', () => {
    const result = calculateHabitProgress_([null, null, null]);

    expect(result.required).toBe(0);
    expect(result.completed).toBe(0);
    expect(result.progress).toBe(0);
  });
});

describe('weekly summaries', () => {
  test('aggregates task progress across days', () => {
    const result = calculateWeekTaskProgress_([
      { completed: 1, total: 2 },
      { completed: 1, total: 1 },
      { completed: 0, total: 0 },
    ]);

    expect(result.taskCompleted).toBe(2);
    expect(result.taskTotal).toBe(3);
    expect(result.weekProgress).toBe(67);
  });

  test('aggregates habit progress across habits', () => {
    const result = calculateHabitSummary_([
      { completed: 2, required: 3 },
      { completed: 1, required: 4 },
    ]);

    expect(result.habitCompleted).toBe(3);
    expect(result.habitRequired).toBe(7);
    expect(result.habitProgress).toBe(43);
  });
});
