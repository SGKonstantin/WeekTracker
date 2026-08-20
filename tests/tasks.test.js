import { describe, expect, test } from 'vitest';
import loader from './helpers/loadAppsScript.js';

const HEADER = ['weekStart', 'day', 'position', 'task', 'done', 'category', 'active'];
const WEEK = '2026-08-10';

function createTasksSheet(taskRows = []) {
  const rows = [HEADER, ...taskRows].map(row => [...row]);

  function ensureCell(row, column) {
    while (rows.length < row) rows.push([]);
    while (rows[row - 1].length < column) rows[row - 1].push('');
  }

  return {
    rows,
    getDataRange: () => ({ getValues: () => rows.map(row => [...row]) }),
    getRange: (row, column) => ({
      getValue: () => rows[row - 1]?.[column - 1] ?? '',
      setValue: value => {
        ensureCell(row, column);
        rows[row - 1][column - 1] = value;
      },
    }),
    appendRow: row => rows.push([...row]),
    getLastRow: () => rows.length,
  };
}

function createBackend(taskRows = []) {
  const sheet = createTasksSheet(taskRows);
  const spreadsheet = {
    getSheetByName: name => name === 'APP_Tasks' ? sheet : null,
  };
  const functions = loader.loadAppsScript({
    PropertiesService: {
      getScriptProperties: () => ({ getProperty: () => 'test-spreadsheet' }),
    },
    SpreadsheetApp: { openById: () => spreadsheet },
  });

  return { sheet, ...functions };
}

function task(position, text, options = {}) {
  return [
    options.week ?? WEEK,
    options.day ?? 1,
    position,
    text,
    options.done ?? false,
    options.category ?? 'Custom',
    options.active ?? true,
  ];
}

describe('addTask', () => {
  test('appends an active incomplete task and returns the current API contract', () => {
    const { sheet, addTask } = createBackend([
      task(1, 'First'),
      task(3, 'Third'),
      task(9, 'Inactive', { active: false }),
      task(8, 'Other day', { day: 2 }),
    ]);

    const result = addTask('2026-08-15', '1', '  New task  ');

    expect(sheet.rows.at(-1)).toEqual([WEEK, 1, 4, 'New task', false, 'Custom', true]);
    expect(result).toEqual({
      ok: true,
      task: {
        row: 6,
        position: 4,
        task: 'New task',
        done: false,
        category: 'Custom',
      },
    });
  });

  test('rejects empty text without appending a row', () => {
    const { sheet, addTask } = createBackend([task(1, 'Existing')]);

    expect(() => addTask(WEEK, 1, '   ')).toThrow('Введите название задачи.');
    expect(sheet.rows).toHaveLength(2);
  });
});

describe('toggleTask', () => {
  test.each([
    [false, true],
    [true, false],
  ])('changes done from %s to %s without changing other fields', (initial, next) => {
    const target = task(2, 'Target', { done: initial, category: 'Work' });
    const neighbor = task(3, 'Neighbor', { done: true });
    const { sheet, toggleTask } = createBackend([target, neighbor]);

    expect(toggleTask(2, next)).toEqual({ ok: true });
    expect(sheet.rows[1]).toEqual([WEEK, 1, 2, 'Target', next, 'Work', true]);
    expect(sheet.rows[2]).toEqual(neighbor);
  });
});

describe('updateTaskText', () => {
  test('trims and changes only the target task text', () => {
    const target = task(1, 'Old', { done: true, category: 'Work' });
    const neighbor = task(2, 'Neighbor');
    const { sheet, updateTaskText } = createBackend([target, neighbor]);

    expect(updateTaskText(2, '  Updated  ')).toEqual({ ok: true });
    expect(sheet.rows[1]).toEqual([WEEK, 1, 1, 'Updated', true, 'Work', true]);
    expect(sheet.rows[2]).toEqual(neighbor);
  });

  test('rejects empty text without changing the task', () => {
    const original = task(1, 'Original');
    const { sheet, updateTaskText } = createBackend([original]);

    expect(() => updateTaskText(2, '')).toThrow('Название задачи не может быть пустым.');
    expect(sheet.rows[1]).toEqual(original);
  });
});

describe('deleteTask', () => {
  test('soft-deletes only the target row and keeps the row physically present', () => {
    const target = task(1, 'Target', { done: true, category: 'Work' });
    const neighbor = task(2, 'Neighbor');
    const { sheet, deleteTask } = createBackend([target, neighbor]);

    expect(deleteTask(2)).toEqual({ ok: true });
    expect(sheet.rows).toHaveLength(3);
    expect(sheet.rows[1]).toEqual([WEEK, 1, 1, 'Target', true, 'Work', false]);
    expect(sheet.rows[2]).toEqual(neighbor);
  });

  test.each([1, 4, 'unknown'])('rejects invalid row %s', row => {
    const { sheet, deleteTask } = createBackend([task(1, 'Target')]);

    expect(() => deleteTask(row)).toThrow('Не удалось найти задачу для удаления.');
    expect(sheet.rows).toHaveLength(2);
    expect(sheet.rows[1][6]).toBe(true);
  });
});

describe('moveTask', () => {
  test('moves up by swapping only positions with the previous task in the same day', () => {
    const first = task(10, 'First', { done: true, category: 'Work' });
    const second = task(20, 'Second', { category: 'Home' });
    const otherDay = task(15, 'Other day', { day: 2, done: true });
    const otherWeek = task(15, 'Other week', { week: '2026-08-17' });
    const { sheet, moveTask } = createBackend([first, second, otherDay, otherWeek]);

    expect(moveTask(3, 'up')).toEqual({ ok: true });
    expect(sheet.rows[1]).toEqual([WEEK, 1, 20, 'First', true, 'Work', true]);
    expect(sheet.rows[2]).toEqual([WEEK, 1, 10, 'Second', false, 'Home', true]);
    expect(sheet.rows[3]).toEqual(otherDay);
    expect(sheet.rows[4]).toEqual(otherWeek);
  });

  test('moves down by swapping only positions with the next active task', () => {
    const first = task(1, 'First');
    const inactive = task(2, 'Inactive', { active: false });
    const last = task(3, 'Last', { done: true });
    const { sheet, moveTask } = createBackend([first, inactive, last]);

    expect(moveTask(2, 'down')).toEqual({ ok: true });
    expect(sheet.rows[1][2]).toBe(3);
    expect(sheet.rows[2]).toEqual(inactive);
    expect(sheet.rows[3]).toEqual([WEEK, 1, 1, 'Last', true, 'Custom', true]);
  });

  test.each([
    ['first task up', 2, 'up'],
    ['last task down', 3, 'down'],
  ])('%s is a successful no-op', (_scenario, row, direction) => {
    const original = [task(1, 'First'), task(2, 'Last')];
    const { sheet, moveTask } = createBackend(original);

    expect(moveTask(row, direction)).toEqual({ ok: true });
    expect(sheet.rows.slice(1)).toEqual(original);
  });

  test.each([1, 4, 'unknown'])('rejects invalid row %s', row => {
    const original = [task(1, 'First'), task(2, 'Last')];
    const { sheet, moveTask } = createBackend(original);

    expect(() => moveTask(row, 'up')).toThrow('Не удалось найти задачу для перемещения.');
    expect(sheet.rows.slice(1)).toEqual(original);
  });
});
