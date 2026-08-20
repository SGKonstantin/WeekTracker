import { describe, expect, test } from 'vitest';
import loader from './helpers/loadAppsScript.js';

const WEEK_START = '2026-08-10';

function createSheet(values) {
  return {
    getDataRange: () => ({ getValues: () => values }),
  };
}

function getAppData({ tasks = [], habits = [], habitLog = [] } = {}) {
  const sheets = {
    APP_Settings: createSheet([
      ['key', 'value'],
      ['weekStart', WEEK_START],
      ['title', 'WeekTracker'],
      ['subtitle', ''],
    ]),
    APP_Tasks: createSheet([
      ['weekStart', 'day', 'position', 'task', 'done', 'category', 'active'],
      ...tasks,
    ]),
    APP_Habits: createSheet([
      ['habitId', 'name', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun', 'active'],
      ...habits,
    ]),
    APP_HabitLog: createSheet([
      ['date', 'habitId', 'done', 'updatedAt'],
      ...habitLog,
    ]),
  };
  const spreadsheet = {
    getSheetByName: name => sheets[name] || null,
  };
  const { getAppData: readAppData } = loader.loadAppsScript({
    PropertiesService: {
      getScriptProperties: () => ({
        getProperty: key => key === 'SPREADSHEET_ID' ? 'test-spreadsheet' : null,
      }),
    },
    SpreadsheetApp: {
      openById: () => spreadsheet,
    },
  });

  return readAppData();
}

function task(done, position) {
  return [WEEK_START, 1, position, `Task ${position}`, done, 'Custom', true];
}

describe('task progress returned by getAppData', () => {
  test.each([
    ['no tasks', [], 0, 0],
    ['one of one completed', [true], 1, 100],
    ['one of two completed', [true, false], 1, 50],
    ['two of three completed', [true, true, false], 2, 67],
    ['all tasks completed', [true, true, true], 3, 100],
    ['no tasks completed', [false, false, false], 0, 0],
  ])('%s', (_scenario, states, expectedCompleted, expectedProgress) => {
    const data = getAppData({
      tasks: states.map((done, index) => task(done, index + 1)),
    });
    const monday = data.days[0];

    expect(monday.total).toBe(states.length);
    expect(monday.completed).toBe(expectedCompleted);
    expect(monday.progress).toBe(expectedProgress);
    expect(data.taskTotal).toBe(states.length);
    expect(data.taskCompleted).toBe(expectedCompleted);
    expect(data.weekProgress).toBe(expectedProgress);
  });
});

describe('habit progress returned by getAppData', () => {
  test('no habits or marks', () => {
    const data = getAppData();

    expect(data.habits).toHaveLength(0);
    expect(data.habitRequired).toBe(0);
    expect(data.habitCompleted).toBe(0);
    expect(data.habitProgress).toBe(0);
  });

  test('one daily habit without completions', () => {
    const data = getAppData({
      habits: [['h1', 'Read', true, true, true, true, true, true, true, true]],
    });

    expect(data.habits[0].required).toBe(7);
    expect(data.habits[0].completed).toBe(0);
    expect(data.habitRequired).toBe(7);
    expect(data.habitCompleted).toBe(0);
    expect(data.habitProgress).toBe(0);
  });

  test('partially completed week', () => {
    const data = getAppData({
      habits: [['h1', 'Read', true, true, true, true, true, true, true, true]],
      habitLog: [
        ['2026-08-10', 'h1', true, ''],
        ['2026-08-11', 'h1', true, ''],
        ['2026-08-12', 'h1', true, ''],
      ],
    });

    expect(data.habits[0].required).toBe(7);
    expect(data.habits[0].completed).toBe(3);
    expect(data.habitRequired).toBe(7);
    expect(data.habitCompleted).toBe(3);
    expect(data.habitProgress).toBe(43);
  });

  test('fully completed scheduled week', () => {
    const data = getAppData({
      habits: [['h1', 'Exercise', true, false, true, false, true, false, false, true]],
      habitLog: [
        ['2026-08-10', 'h1', true, ''],
        ['2026-08-12', 'h1', true, ''],
        ['2026-08-14', 'h1', true, ''],
      ],
    });

    expect(data.habits[0].required).toBe(3);
    expect(data.habits[0].completed).toBe(3);
    expect(data.habitRequired).toBe(3);
    expect(data.habitCompleted).toBe(3);
    expect(data.habitProgress).toBe(100);
  });
});
