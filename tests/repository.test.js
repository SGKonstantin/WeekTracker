import { describe, expect, test } from 'vitest';
import loader from './helpers/loadAppsScript.js';

const TASK_HEADER = ['weekStart', 'day', 'position', 'task', 'done', 'category', 'active'];
const HABIT_HEADER = ['habitId', 'name', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun', 'active'];
const LOG_HEADER = ['date', 'habitId', 'done', 'updatedAt'];

function createSheet(initialRows = []) {
  const rows = initialRows.map(row => [...row]);
  const numberFormats = new Map();

  function ensureCell(row, column) {
    while (rows.length < row) rows.push([]);
    while (rows[row - 1].length < column) rows[row - 1].push('');
  }

  return {
    rows,
    numberFormats,
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
      setNumberFormat: format => numberFormats.set(`${row}:${column}`, format),
    }),
    appendRow: row => rows.push([...row]),
    getLastRow: () => rows.length,
  };
}

function createRepository(overrides = {}) {
  const sheets = {
    APP_Settings: createSheet([['key', 'value'], ['weekStart', '2026-08-10']]),
    APP_Tasks: createSheet([TASK_HEADER]),
    APP_Habits: createSheet([HABIT_HEADER]),
    APP_HabitLog: createSheet([LOG_HEADER]),
    ...overrides,
  };
  const requestedIds = [];
  const spreadsheet = {
    getSheetByName: name => sheets[name] || null,
    getUrl: () => 'https://example.test/weektracker-data',
  };
  const functions = loader.loadAppsScript({
    PropertiesService: {
      getScriptProperties: () => ({
        getProperty: key => key === 'SPREADSHEET_ID' ? 'spreadsheet-123' : null,
      }),
    },
    SpreadsheetApp: {
      openById: id => {
        requestedIds.push(id);
        return spreadsheet;
      },
    },
  });

  return { sheets, spreadsheet, requestedIds, ...functions };
}

describe('spreadsheet and sheet access', () => {
  test('opens the configured spreadsheet and returns the requested APP sheet', () => {
    const repository = createRepository();

    expect(repository.getSpreadsheetId_()).toBe('spreadsheet-123');
    expect(repository.getAppSheet_('APP_Tasks')).toBe(repository.sheets.APP_Tasks);
    expect(repository.requestedIds).toEqual(['spreadsheet-123']);
  });

  test('rejects a missing APP sheet', () => {
    const repository = createRepository();

    expect(() => repository.getAppSheet_('APP_Missing')).toThrow('Не найден лист: APP_Missing');
  });
});

describe('task repository operations', () => {
  test('reads task rows as records with physical row numbers', () => {
    const tasks = createSheet([
      TASK_HEADER,
      ['2026-08-10', 1, 1, 'First', false, 'Work', true],
      ['', '', '', '', '', '', ''],
      ['2026-08-10', 2, 1, 'Second', true, 'Home', true],
    ]);
    const repository = createRepository({ APP_Tasks: tasks });

    const records = repository.getTaskRecords_();

    expect(records).toHaveLength(2);
    expect(records[0].task).toBe('First');
    expect(records[0]._row).toBe(2);
    expect(records[1].task).toBe('Second');
    expect(records[1]._row).toBe(4);
  });

  test('appends a task in APP_Tasks column order and returns its row', () => {
    const repository = createRepository();

    const row = repository.appendTask_({
      weekStart: '2026-08-10', day: '2', position: 3, task: 'New',
      done: false, category: 'Custom', active: true,
    });

    expect(row).toBe(2);
    expect(repository.sheets.APP_Tasks.rows[1])
      .toEqual(['2026-08-10', 2, 3, 'New', false, 'Custom', true]);
  });

  test('updates only the requested task cells', () => {
    const first = ['2026-08-10', 1, 1, 'First', false, 'Work', true];
    const second = ['2026-08-10', 1, 2, 'Second', true, 'Home', true];
    const tasks = createSheet([TASK_HEADER, first, second]);
    const repository = createRepository({ APP_Tasks: tasks });

    repository.setTaskDone_(2, true);
    repository.setTaskText_(2, 'Updated');
    repository.setTaskPosition_(2, 7);
    repository.setTaskActive_(2, false);

    expect(tasks.rows[1]).toEqual(['2026-08-10', 1, 7, 'Updated', true, 'Work', false]);
    expect(tasks.rows[2]).toEqual(second);
  });
});

describe('habit repository operations', () => {
  test('reads habit rows without changing their stored schedule', () => {
    const stored = ['h1', 'Reading', true, false, true, false, true, false, true, true];
    const habits = createSheet([HABIT_HEADER, stored]);
    const repository = createRepository({ APP_Habits: habits });

    const records = repository.getHabitRecords_();

    expect(records[0].habitId).toBe('h1');
    expect(records[0].mon).toBe(true);
    expect(records[0].tue).toBe(false);
    expect(records[0]._row).toBe(2);
  });

  test('appends a habit in APP_Habits column order', () => {
    const repository = createRepository();

    repository.appendHabit_('h1', {
      name: 'Reading',
      schedule: [true, false, true, false, true, false, true],
      active: true,
    });

    expect(repository.sheets.APP_Habits.rows[1])
      .toEqual(['h1', 'Reading', true, false, true, false, true, false, true, true]);
  });

  test('soft-deletes only the requested habit row', () => {
    const first = ['h1', 'First', true, true, true, true, true, true, true, true];
    const second = ['h2', 'Second', true, false, true, false, true, false, true, true];
    const habits = createSheet([HABIT_HEADER, first, second]);
    const repository = createRepository({ APP_Habits: habits });

    repository.setHabitActive_(2, false);

    expect(habits.rows[1]).toEqual([...first.slice(0, 9), false]);
    expect(habits.rows[2]).toEqual(second);
  });
});

describe('HabitLog repository operations', () => {
  test('reads log rows as records', () => {
    const log = createSheet([LOG_HEADER, ['2026-08-10', 'h1', false, 'old']]);
    const repository = createRepository({ APP_HabitLog: log });

    expect(repository.getHabitLogRecords_()[0]).toMatchObject({
      date: '2026-08-10', habitId: 'h1', done: false, updatedAt: 'old', _row: 2,
    });
  });

  test('updates only done and updatedAt in the requested log row', () => {
    const first = ['2026-08-10', 'h1', false, 'old'];
    const second = ['2026-08-10', 'h2', true, 'untouched'];
    const log = createSheet([LOG_HEADER, first, second]);
    const repository = createRepository({ APP_HabitLog: log });

    repository.updateHabitLog_(2, true, 'new-time');

    expect(log.rows[1]).toEqual(['2026-08-10', 'h1', true, 'new-time']);
    expect(log.rows[2]).toEqual(second);
  });

  test('appends a complete log record', () => {
    const repository = createRepository();

    repository.appendHabitLog_({
      date: '2026-08-10', habitId: 'h1', done: true, updatedAt: 'now',
    });

    expect(repository.sheets.APP_HabitLog.rows[1]).toEqual(['2026-08-10', 'h1', true, 'now']);
  });
});

describe('settings repository operations', () => {
  test('reads, updates and appends settings without touching adjacent rows', () => {
    const settings = createSheet([
      ['key', 'value'],
      ['weekStart', '2026-08-10'],
      ['title', 'WeekTracker'],
    ]);
    const repository = createRepository({ APP_Settings: settings });

    expect(repository.getSetting_('weekStart')).toBe('2026-08-10');
    repository.setSetting_('weekStart', '2026-08-17');
    repository.setSetting_('theme', 'warm');

    expect(settings.rows[1]).toEqual(['weekStart', '2026-08-17']);
    expect(settings.rows[2]).toEqual(['title', 'WeekTracker']);
    expect(settings.rows[3]).toEqual(['theme', 'warm']);
    expect(settings.numberFormats.get('2:2')).toBe('@');
    expect(settings.numberFormats.get('4:2')).toBe('@');
  });

});
