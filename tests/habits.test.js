import { describe, expect, test } from 'vitest';
import loader from './helpers/loadAppsScript.js';

const WEEK = '2026-08-10';
const HABITS_HEADER = ['habitId', 'name', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun', 'active'];
const LOG_HEADER = ['date', 'habitId', 'done', 'updatedAt'];

function createSheet(initialRows) {
  const rows = initialRows.map(row => [...row]);

  function ensureCell(row, column) {
    while (rows.length < row) rows.push([]);
    while (rows[row - 1].length < column) rows[row - 1].push('');
  }

  return {
    rows,
    getDataRange: () => ({ getValues: () => rows.map(row => [...row]) }),
    getRange: (row, column, rowCount = 1, columnCount = 1) => ({
      getValue: () => rows[row - 1]?.[column - 1] ?? '',
      getValues: () => Array.from({ length: rowCount }, (_, rowOffset) =>
        Array.from({ length: columnCount }, (_, columnOffset) =>
          rows[row - 1 + rowOffset]?.[column - 1 + columnOffset] ?? ''
        )
      ),
      setValue: value => {
        ensureCell(row, column);
        rows[row - 1][column - 1] = value;
      },
      setValues: values => {
        values.forEach((valueRow, rowOffset) => {
          valueRow.forEach((value, columnOffset) => {
            ensureCell(row + rowOffset, column + columnOffset);
            rows[row - 1 + rowOffset][column - 1 + columnOffset] = value;
          });
        });
      },
    }),
    appendRow: row => rows.push([...row]),
    getLastRow: () => rows.length,
  };
}

function createBackend({ habits = [], habitLog = [] } = {}) {
  const sheets = {
    APP_Settings: createSheet([
      ['key', 'value'],
      ['weekStart', WEEK],
      ['title', 'WeekTracker'],
      ['subtitle', ''],
    ]),
    APP_Tasks: createSheet([
      ['weekStart', 'day', 'position', 'task', 'done', 'category', 'active'],
    ]),
    APP_Habits: createSheet([HABITS_HEADER, ...habits]),
    APP_HabitLog: createSheet([LOG_HEADER, ...habitLog]),
  };
  const spreadsheet = { getSheetByName: name => sheets[name] || null };
  const functions = loader.loadAppsScript({
    PropertiesService: {
      getScriptProperties: () => ({
        getProperty: key => key === 'SPREADSHEET_ID' ? 'test-spreadsheet' : null,
      }),
    },
    SpreadsheetApp: { openById: () => spreadsheet },
  });

  return { sheets, ...functions };
}

function habit(id, name, schedule, active = true) {
  return [id, name, ...schedule, active];
}

function isDate(value) {
  return Object.prototype.toString.call(value) === '[object Date]' && !isNaN(value.getTime());
}

describe('addHabit', () => {
  test('appends a trimmed active habit with its seven-day schedule and returns its id', () => {
    const schedule = [true, false, true, false, true, false, true];
    const { sheets, addHabit } = createBackend();

    const result = addHabit('  Reading  ', schedule);
    const added = sheets.APP_Habits.rows[1];

    expect(result.ok).toBe(true);
    expect(result.id).toMatch(/^h_\d+$/);
    expect(added).toEqual([result.id, 'Reading', ...schedule, true]);
    expect(added).toHaveLength(10);
  });

  test('uses an all-days schedule when the supplied value is not a seven-item array', () => {
    const { sheets, addHabit } = createBackend();

    addHabit('Reading', [false, false]);

    expect(sheets.APP_Habits.rows[1].slice(2, 9)).toEqual([true, true, true, true, true, true, true]);
  });

  test('coerces each item of a seven-day schedule to boolean', () => {
    const { sheets, addHabit } = createBackend();

    addHabit('Reading', [1, 0, 'yes', '', null, {}, false]);

    expect(sheets.APP_Habits.rows[1].slice(2, 9)).toEqual([true, false, true, false, false, true, false]);
  });

  test('rejects an empty name without appending a row', () => {
    const { sheets, addHabit } = createBackend();

    expect(() => addHabit('   ', [true, true, true, true, true, true, true]))
      .toThrow('Введите название привычки.');
    expect(sheets.APP_Habits.rows).toHaveLength(1);
  });

  test('rejects a seven-day schedule with no enabled days', () => {
    const { sheets, addHabit } = createBackend();

    expect(() => addHabit('Reading', [false, false, false, false, false, false, false]))
      .toThrow('Выбери хотя бы один день недели.');
    expect(sheets.APP_Habits.rows).toHaveLength(1);
  });

  test('rejects an exact duplicate active habit without appending a row', () => {
    const existing = habit('h1', 'Английский', [true, true, true, true, true, false, false]);
    const { sheets, addHabit } = createBackend({ habits: [existing] });

    expect(addHabit('Английский', [false, false, false, false, false, true, true])).toEqual({
      ok: false,
      code: 'DUPLICATE_HABIT_NAME',
      message: 'Привычка с таким названием уже существует',
    });
    expect(sheets.APP_Habits.rows).toEqual([HABITS_HEADER, existing]);
  });

  test('rejects a duplicate active habit with different letter case', () => {
    const existing = habit('h1', 'Английский', [true, true, true, true, true, true, true]);
    const { sheets, addHabit } = createBackend({ habits: [existing] });

    expect(addHabit('АНГЛИЙСКИЙ', [true, true, true, true, true, true, true]).ok).toBe(false);
    expect(sheets.APP_Habits.rows).toHaveLength(2);
  });

  test('rejects a duplicate active habit with surrounding whitespace', () => {
    const existing = habit('h1', 'Английский', [true, true, true, true, true, true, true]);
    const { sheets, addHabit } = createBackend({ habits: [existing] });

    expect(addHabit('  английский  ', [true, true, true, true, true, true, true]).ok).toBe(false);
    expect(sheets.APP_Habits.rows).toHaveLength(2);
  });

  test('allows the same name after the old habit is soft-deleted', () => {
    const existing = habit('h1', 'Английский', [true, true, true, true, true, true, true]);
    const { sheets, addHabit, deleteHabit } = createBackend({ habits: [existing] });

    deleteHabit('h1');
    const result = addHabit('Английский', [true, false, true, false, true, false, true]);

    expect(result.ok).toBe(true);
    expect(sheets.APP_Habits.rows).toHaveLength(3);
    expect(sheets.APP_Habits.rows[1][9]).toBe(false);
    expect(sheets.APP_Habits.rows[2][0]).toBe(result.id);
  });

  test('does not change unrelated habits when rejecting a duplicate', () => {
    const english = habit('h1', 'Английский', [true, true, true, true, true, false, false]);
    const sport = habit('h2', 'Спорт', [false, true, false, true, false, true, false]);
    const { sheets, addHabit } = createBackend({ habits: [english, sport] });
    const snapshot = sheets.APP_Habits.rows.map(row => [...row]);

    const result = addHabit('английский', [true, false, true, false, true, false, true]);

    expect(result.ok).toBe(false);
    expect(sheets.APP_Habits.rows).toEqual(snapshot);
  });
});

describe('toggleHabit', () => {
  test.each([
    [false, true],
    [true, false],
  ])('changes an existing mark from %s to %s without changing adjacent records', (initial, next) => {
    const otherDay = ['2026-08-11', 'h1', true, 'other-day'];
    const otherHabit = [WEEK, 'h2', true, 'other-habit'];
    const { sheets, toggleHabit } = createBackend({
      habits: [habit('h1', 'First', [true, true, true, true, true, true, true])],
      habitLog: [[WEEK, 'h1', initial, 'old'], otherDay, otherHabit],
    });

    expect(toggleHabit(WEEK, 'h1', next)).toEqual({ ok: true });
    expect(sheets.APP_HabitLog.rows[1][0]).toBe(WEEK);
    expect(sheets.APP_HabitLog.rows[1][1]).toBe('h1');
    expect(sheets.APP_HabitLog.rows[1][2]).toBe(next);
    expect(isDate(sheets.APP_HabitLog.rows[1][3])).toBe(true);
    expect(sheets.APP_HabitLog.rows[2]).toEqual(otherDay);
    expect(sheets.APP_HabitLog.rows[3]).toEqual(otherHabit);
  });

  test('rejects a temporary optimistic habit id without appending a log row', () => {
    const { sheets, toggleHabit } = createBackend();

    expect(toggleHabit(WEEK, 'tmp_h_123', true)).toEqual({
      ok: false,
      code: 'HABIT_NOT_FOUND',
    });
    expect(sheets.APP_HabitLog.rows).toEqual([LOG_HEADER]);
  });

  test('rejects an unknown habit id without appending a log row', () => {
    const { sheets, toggleHabit } = createBackend();

    expect(toggleHabit('10.08.2026', 'missing-habit', true)).toEqual({
      ok: false,
      code: 'HABIT_NOT_FOUND',
    });
    expect(sheets.APP_HabitLog.rows).toEqual([LOG_HEADER]);
  });

  test('rejects an inactive habit id without appending a log row', () => {
    const inactive = habit('h1', 'Inactive', [true, true, true, true, true, true, true], false);
    const existingLog = ['2026-08-09', 'h1', true, 'old'];
    const { sheets, toggleHabit } = createBackend({ habits: [inactive], habitLog: [existingLog] });

    expect(toggleHabit(WEEK, 'h1', true)).toEqual({
      ok: false,
      code: 'HABIT_NOT_FOUND',
    });
    expect(sheets.APP_HabitLog.rows).toEqual([LOG_HEADER, existingLog]);
  });

  test('appends a normalized mark for an existing active habit', () => {
    const active = habit('h1', 'Active', [true, true, true, true, true, true, true]);
    const { sheets, toggleHabit } = createBackend({ habits: [active] });

    expect(toggleHabit('10.08.2026', 'h1', 1)).toEqual({ ok: true });
    const added = sheets.APP_HabitLog.rows[1];
    expect(added.slice(0, 3)).toEqual([WEEK, 'h1', true]);
    expect(isDate(added[3])).toBe(true);
  });

  test('updates only the latest legacy duplicate for the same date and habit', () => {
    const { sheets, toggleHabit } = createBackend({
      habits: [habit('h1', 'First', [true, true, true, true, true, true, true])],
      habitLog: [
        [WEEK, 'h1', false, 'first'],
        [WEEK, 'h1', false, 'second'],
      ],
    });

    toggleHabit(WEEK, 'h1', true);

    expect(sheets.APP_HabitLog.rows[1]).toEqual([WEEK, 'h1', false, 'first']);
    expect(sheets.APP_HabitLog.rows[2].slice(0, 3)).toEqual([WEEK, 'h1', true]);
    expect(isDate(sheets.APP_HabitLog.rows[2][3])).toBe(true);
    expect(sheets.APP_HabitLog.rows).toHaveLength(3);
  });

  test('rejects an invalid date without changing the log', () => {
    const original = [WEEK, 'h1', false, 'original'];
    const { sheets, toggleHabit } = createBackend({ habitLog: [original] });

    expect(() => toggleHabit('not-a-date', 'h1', true)).toThrow('Некорректная дата привычки.');
    expect(sheets.APP_HabitLog.rows[1]).toEqual(original);
  });
});

describe('deleteHabit', () => {
  test('soft-deletes only the matching habit and leaves HabitLog untouched', () => {
    const first = habit('h1', 'First', [true, true, true, true, true, true, true]);
    const second = habit('h2', 'Second', [true, false, true, false, true, false, true]);
    const log = [WEEK, 'h1', true, 'existing'];
    const { sheets, deleteHabit } = createBackend({ habits: [first, second], habitLog: [log] });

    expect(deleteHabit('h1')).toEqual({ ok: true });
    expect(sheets.APP_Habits.rows).toHaveLength(3);
    expect(sheets.APP_Habits.rows[1]).toEqual([...first.slice(0, 9), false]);
    expect(sheets.APP_Habits.rows[2]).toEqual(second);
    expect(sheets.APP_HabitLog.rows[1]).toEqual(log);
  });

  test('rejects an unknown habit id without changing definitions', () => {
    const original = habit('h1', 'First', [true, true, true, true, true, true, true]);
    const { sheets, deleteHabit } = createBackend({ habits: [original] });

    expect(() => deleteHabit('missing')).toThrow('Не удалось найти привычку для удаления.');
    expect(sheets.APP_Habits.rows[1]).toEqual(original);
  });

  test('deactivates only the first definition when duplicate habit ids exist', () => {
    const first = habit('h1', 'First', [true, true, true, true, true, true, true]);
    const duplicate = habit('h1', 'Duplicate', [false, true, false, true, false, true, false]);
    const { sheets, deleteHabit } = createBackend({ habits: [first, duplicate] });

    deleteHabit('h1');

    expect(sheets.APP_Habits.rows[1][9]).toBe(false);
    expect(sheets.APP_Habits.rows[2]).toEqual(duplicate);
  });
});

describe('habit data returned by getAppData', () => {
  test('preserves the seven-day schedule and excludes inactive habits', () => {
    const schedule = [true, false, true, false, true, false, false];
    const { getAppData } = createBackend({
      habits: [
        habit('h1', 'Active', schedule),
        habit('h2', 'Inactive', [true, true, true, true, true, true, true], false),
      ],
      habitLog: [[WEEK, 'h1', true, '']],
    });

    const data = getAppData();

    expect(data.habits).toHaveLength(1);
    expect(data.habits[0].schedule).toEqual(schedule);
    expect(data.habits[0].values).toEqual([true, null, false, null, false, null, null]);
    expect(data.habits[0].required).toBe(3);
    expect(data.habits[0].completed).toBe(1);
  });

  test('uses the last duplicate HabitLog record for displayed state', () => {
    const { getAppData } = createBackend({
      habits: [habit('h1', 'Habit', [true, false, false, false, false, false, false])],
      habitLog: [
        [WEEK, 'h1', true, 'first'],
        [WEEK, 'h1', false, 'second'],
      ],
    });

    const data = getAppData();

    expect(data.habits[0].values[0]).toBe(false);
    expect(data.habits[0].completed).toBe(0);
  });
});
