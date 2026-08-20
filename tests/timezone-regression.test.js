import { describe, expect, test } from 'vitest';
import loader from './helpers/loadAppsScript.js';

const TASK_HEADER = ['weekStart', 'day', 'position', 'task', 'done', 'category', 'active'];
const HABIT_HEADER = ['habitId', 'name', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun', 'active'];
const LOG_HEADER = ['date', 'habitId', 'done', 'updatedAt'];

function moscowMidnight(iso) {
  return new Date(`${iso}T00:00:00+03:00`);
}

function createSheet(initialRows, dateOnlyColumns = []) {
  const rows = initialRows.map(row => [...row]);

  function storedValue(value, column) {
    return dateOnlyColumns.includes(column) && /^\d{4}-\d{2}-\d{2}$/.test(String(value))
      ? moscowMidnight(value)
      : value;
  }

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
        rows[row - 1][column - 1] = storedValue(value, column);
      },
      setValues: values => {
        values.forEach((valueRow, rowOffset) => valueRow.forEach((value, columnOffset) => {
          ensureCell(row + rowOffset, column + columnOffset);
          rows[row - 1 + rowOffset][column - 1 + columnOffset] = storedValue(value, column + columnOffset);
        }));
      },
      setNumberFormat: () => {},
    }),
    appendRow: row => rows.push(row.map((value, index) => storedValue(value, index + 1))),
    getLastRow: () => rows.length,
  };
}

function createBackend(weekStart = '2026-08-17') {
  const sheets = {
    APP_Settings: createSheet([
      ['key', 'value'],
      ['weekStart', moscowMidnight(weekStart)],
      ['title', 'WeekTracker'],
      ['subtitle', ''],
    ], [2]),
    APP_Tasks: createSheet([TASK_HEADER], [1]),
    APP_Habits: createSheet([
      HABIT_HEADER,
      ['h1', 'Daily', true, true, true, true, true, true, true, true],
    ]),
    APP_HabitLog: createSheet([LOG_HEADER], [1]),
  };
  const spreadsheet = {
    getSheetByName: name => sheets[name] || null,
    getSpreadsheetTimeZone: () => 'Europe/Moscow',
  };
  const functions = loader.loadAppsScript({
    PropertiesService: {
      getScriptProperties: () => ({ getProperty: () => 'test-spreadsheet' }),
    },
    SpreadsheetApp: { openById: () => spreadsheet },
  });

  return { sheets, ...functions };
}

describe('Google Sheets date-only timezone regression', () => {
  test('keeps a Moscow local-midnight weekday on its calendar date', () => {
    const { formatSheetDateOnly_ } = createBackend();

    expect(formatSheetDateOnly_(moscowMidnight('2026-08-17'))).toBe('2026-08-17');
  });

  test('keeps a Moscow local-midnight Sunday on its calendar date', () => {
    const { formatSheetDateOnly_ } = createBackend();

    expect(formatSheetDateOnly_(moscowMidnight('2026-08-23'))).toBe('2026-08-23');
  });

  test('uses the spreadsheet timezone west of UTC as well', () => {
    const spreadsheet = {
      getSheetByName: () => null,
      getSpreadsheetTimeZone: () => 'America/Los_Angeles',
    };
    const { formatSheetDateOnly_ } = loader.loadAppsScript({
      PropertiesService: {
        getScriptProperties: () => ({ getProperty: () => 'test-spreadsheet' }),
      },
      SpreadsheetApp: { openById: () => spreadsheet },
    });
    const losAngelesMidnight = new Date('2026-08-17T07:00:00Z');

    expect(formatSheetDateOnly_(losAngelesMidnight)).toBe('2026-08-17');
  });

  test('round-trips weekStart through a Sheet date cell', () => {
    const { setSetting_, getSetting_ } = createBackend();

    setSetting_('weekStart', '2026-08-17');

    expect(getSetting_('weekStart')).toBe('2026-08-17');
  });

  test('keeps a newly added task in the same week after reload', () => {
    const { addTask, getAppData } = createBackend();

    addTask('2026-08-17', 1, 'Regression task');
    const reloaded = getAppData();

    expect(reloaded.weekStart).toBe('2026-08-17');
    expect(reloaded.days[0].tasks.map(task => task.task)).toContain('Regression task');
  });

  test('keeps all seven habit marks in the current week after reload', () => {
    const backend = createBackend();
    const dates = [
      '2026-08-17', '2026-08-18', '2026-08-19', '2026-08-20',
      '2026-08-21', '2026-08-22', '2026-08-23',
    ];

    dates.forEach(date => backend.toggleHabit(date, 'h1', true));
    const currentWeek = backend.getAppData();

    expect(currentWeek.habits[0].values).toEqual([true, true, true, true, true, true, true]);

    backend.setWeekStart('2026-08-10');
    const previousWeek = backend.getAppData();
    expect(previousWeek.days[6].date).toBe('2026-08-16');
    expect(previousWeek.habits[0].values[6]).toBe(false);
  });
});
