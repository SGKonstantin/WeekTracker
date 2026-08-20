import { beforeAll, describe, expect, test } from 'vitest';
import loader from './helpers/loadAppsScript.js';

let hasActiveHabitWithName_;
let normalizeHabitSchedule_;
let createHabitData_;
let findLastHabitLogMatch_;
let buildHabitLogMap_;

beforeAll(() => {
  ({
    hasActiveHabitWithName_,
    normalizeHabitSchedule_,
    createHabitData_,
    findLastHabitLogMatch_,
    buildHabitLogMap_,
  } = loader.loadAppsScript());
});

describe('hasActiveHabitWithName_', () => {
  test('detects the same active habit name', () => {
    expect(hasActiveHabitWithName_([{ name: 'Английский', active: true }], 'Английский')).toBe(true);
  });

  test('ignores surrounding whitespace when comparing names', () => {
    expect(hasActiveHabitWithName_([{ name: 'Английский', active: true }], ' английский ')).toBe(true);
  });

  test('compares names case-insensitively', () => {
    expect(hasActiveHabitWithName_([{ name: 'Английский', active: true }], 'АНГЛИЙСКИЙ')).toBe(true);
  });

  test('does not treat an inactive habit as a duplicate', () => {
    expect(hasActiveHabitWithName_([{ name: 'Английский', active: false }], 'Английский')).toBe(false);
  });

  test('allows a different active habit name', () => {
    expect(hasActiveHabitWithName_([{ name: 'Английский', active: true }], 'Спорт')).toBe(false);
  });

  test('ignores multiple unrelated habits', () => {
    const habits = [
      { name: 'Спорт', active: true },
      { name: 'Чтение', active: true },
      { name: 'Медитация', active: false },
    ];

    expect(hasActiveHabitWithName_(habits, 'Английский')).toBe(false);
  });

  test('does not mutate the source habits array or its objects', () => {
    const habits = [
      { name: ' Английский ', active: true, schedule: [true, false] },
      { name: 'Спорт', active: false, metadata: { color: 'green' } },
    ];
    const snapshot = JSON.parse(JSON.stringify(habits));

    hasActiveHabitWithName_(habits, 'АНГЛИЙСКИЙ');

    expect(habits).toEqual(snapshot);
  });
});

describe('normalizeHabitSchedule_', () => {
  test('preserves seven boolean values', () => {
    const schedule = [true, false, true, false, true, false, true];

    expect(normalizeHabitSchedule_(schedule)).toEqual(schedule);
  });

  test('converts truthy and falsy values to booleans', () => {
    expect(normalizeHabitSchedule_([1, 0, 'yes', '', null, {}, false]))
      .toEqual([true, false, true, false, false, true, false]);
  });

  test.each([
    ['wrong length', [true, false]],
    ['empty array', []],
    ['non-array input', null],
  ])('uses a daily schedule for %s', (_scenario, schedule) => {
    expect(normalizeHabitSchedule_(schedule)).toEqual([true, true, true, true, true, true, true]);
  });

  test('does not mutate the source and returns a new array', () => {
    const schedule = [1, 0, 1, 0, 1, 0, 1];
    const snapshot = [...schedule];

    const result = normalizeHabitSchedule_(schedule);

    expect(schedule).toEqual(snapshot);
    expect(result).not.toBe(schedule);
  });
});

describe('createHabitData_', () => {
  test('creates normalized active habit data without an infrastructure id', () => {
    expect(createHabitData_('  Reading  ', [true, false, true, false, true, false, true])).toEqual({
      name: 'Reading',
      schedule: [true, false, true, false, true, false, true],
      active: true,
    });
  });
});

describe('findLastHabitLogMatch_', () => {
  test('returns -1 when there are no records', () => {
    expect(findLastHabitLogMatch_([], 'h1', '2026-08-10')).toBe(-1);
  });

  test('returns the index of one matching record', () => {
    expect(findLastHabitLogMatch_([
      { date: '2026-08-10', habitId: 'h1', done: false },
    ], 'h1', '2026-08-10')).toBe(0);
  });

  test('ignores unrelated records', () => {
    const records = [
      { date: '2026-08-10', habitId: 'h2' },
      { date: '2026-08-11', habitId: 'h1' },
      { date: '2026-08-10', habitId: 'h1' },
      { date: '2026-08-12', habitId: 'h3' },
    ];

    expect(findLastHabitLogMatch_(records, 'h1', '2026-08-10')).toBe(2);
  });

  test('returns the last index for duplicate habit and date records', () => {
    const records = [
      { date: '2026-08-10', habitId: 'h1', done: false },
      { date: '2026-08-10', habitId: 'h1', done: true },
      { date: '2026-08-10', habitId: 'h1', done: false },
    ];

    expect(findLastHabitLogMatch_(records, 'h1', '2026-08-10')).toBe(2);
  });

  test('does not match another habit id', () => {
    expect(findLastHabitLogMatch_([
      { date: '2026-08-10', habitId: 'h2' },
    ], 'h1', '2026-08-10')).toBe(-1);
  });

  test('does not match another date', () => {
    expect(findLastHabitLogMatch_([
      { date: '2026-08-11', habitId: 'h1' },
    ], 'h1', '2026-08-10')).toBe(-1);
  });

  test('does not mutate the input records', () => {
    const records = [
      { date: '10.08.2026', habitId: 'h1', done: false },
      { date: '2026-08-10', habitId: 'h1', done: true },
    ];
    const snapshot = JSON.parse(JSON.stringify(records));

    findLastHabitLogMatch_(records, 'h1', '2026-08-10');

    expect(records).toEqual(snapshot);
  });
});

describe('buildHabitLogMap_', () => {
  test('uses the last duplicate record and ignores invalid dates', () => {
    const map = buildHabitLogMap_([
      { date: '2026-08-10', habitId: 'h1', done: true },
      { date: 'not-a-date', habitId: 'h1', done: true },
      { date: '10.08.2026', habitId: 'h1', done: false },
      { date: '2026-08-10', habitId: 'h2', done: true },
    ]);

    expect(map['2026-08-10|h1']).toBe(false);
    expect(map['2026-08-10|h2']).toBe(true);
    expect(Object.keys(map)).toHaveLength(2);
  });
});
