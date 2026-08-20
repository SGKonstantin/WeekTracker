import { describe, expect, test } from 'vitest';
import loader from './helpers/loadAppsScript.js';

function columnToNumber(column) {
  return [...column].reduce((value, char) => value * 26 + char.charCodeAt(0) - 64, 0);
}

function createSheet(initialName = 'Sheet1') {
  let name = initialName;
  let rows = [];
  const numberFormats = [];
  let hidden = false;

  function ensureCell(row, column) {
    while (rows.length < row) rows.push([]);
    while (rows[row - 1].length < column) rows[row - 1].push('');
  }

  function parseA1(a1) {
    const match = /^([A-Z]+)(\d+)?/.exec(a1);
    return {
      row: match?.[2] ? Number(match[2]) : 1,
      column: match ? columnToNumber(match[1]) : 1,
    };
  }

  return {
    getName: () => name,
    setName: value => { name = value; },
    getLastRow: () => rows.length,
    getLastColumn: () => Math.max(1, ...rows.map(row => row.length)),
    getDataRange: () => ({ getValues: () => rows.map(row => [...row]) }),
    getRange: (rowOrA1, column = 1) => {
      const start = typeof rowOrA1 === 'string' ? parseA1(rowOrA1) : { row: rowOrA1, column };
      const range = {
        getValue: () => rows[start.row - 1]?.[start.column - 1] ?? '',
        setValue: value => {
          ensureCell(start.row, start.column);
          rows[start.row - 1][start.column - 1] = value;
        },
        setValues: values => values.forEach((valueRow, rowOffset) =>
          valueRow.forEach((value, columnOffset) => {
            ensureCell(start.row + rowOffset, start.column + columnOffset);
            rows[start.row - 1 + rowOffset][start.column - 1 + columnOffset] = value;
          })
        ),
        setNumberFormat: format => { numberFormats.push({ range: rowOrA1, format }); return range; },
        setFontWeight: () => range,
        setFontSize: () => range,
        setWrap: () => range,
      };
      return range;
    },
    setFrozenRows: () => {},
    isSheetHidden: () => hidden,
    hideSheet: () => { hidden = true; },
    showSheet: () => { hidden = false; },
    clear: () => { rows = []; },
    setColumnWidth: () => {},
    _rows: () => rows,
    _formats: numberFormats,
    _hidden: () => hidden,
  };
}

function createSpreadsheet(id, initialSheets = [createSheet()]) {
  const sheets = [...initialSheets];
  return {
    getId: () => id,
    getUrl: () => `spreadsheet-url-${id}`,
    getSheets: () => [...sheets],
    getSheetByName: name => sheets.find(sheet => sheet.getName() === name) || null,
    insertSheet: name => {
      const sheet = createSheet(name);
      sheets.push(sheet);
      return sheet;
    },
  };
}

function createSetupEnvironment({ activeSpreadsheet = null, webAppUrl = null } = {}) {
  const properties = webAppUrl ? { WEB_APP_URL: webAppUrl } : {};
  const created = [];
  const standaloneSpreadsheet = createSpreadsheet('standalone-id');
  const SpreadsheetApp = {
    getActiveSpreadsheet: () => activeSpreadsheet,
    create: name => {
      created.push(name);
      return standaloneSpreadsheet;
    },
    openById: id => {
      if (activeSpreadsheet?.getId() === id) return activeSpreadsheet;
      if (standaloneSpreadsheet.getId() === id) return standaloneSpreadsheet;
      throw new Error('Spreadsheet not found');
    },
    flush: () => {},
  };
  const PropertiesService = {
    getScriptProperties: () => ({
      getProperty: key => properties[key] ?? null,
      setProperties: values => Object.assign(properties, values),
      deleteProperty: key => { delete properties[key]; },
    }),
  };
  const functions = loader.loadAppsScript({ SpreadsheetApp, PropertiesService });
  return { properties, created, standaloneSpreadsheet, ...functions };
}

const systemSheets = ['APP_Settings', 'APP_Tasks', 'APP_Habits', 'APP_HabitLog'];

describe('setupProject installation modes', () => {
  test('uses the active bound spreadsheet without creating a separate spreadsheet', () => {
    const bound = createSpreadsheet('bound-id');
    const environment = createSetupEnvironment({ activeSpreadsheet: bound });

    expect(environment.setupProject()).toBe('spreadsheet-url-bound-id');
    expect(environment.created).toEqual([]);
    expect(environment.properties.SPREADSHEET_ID).toBe('bound-id');
    expect(systemSheets.every(name => bound.getSheetByName(name))).toBe(true);
    expect(bound.getSheetByName('APP_Tasks')._rows()).toHaveLength(1);
    expect(bound.getSheetByName('APP_Habits')._rows()).toHaveLength(1);
    expect(bound.getSheetByName('WeekTracker')._rows()[0][0]).toBe('WeekTracker');
    expect(bound.getSheetByName('WeekTracker')._rows()[2][0]).toBe('Недельный планировщик и трекер привычек');
    const landingText = bound.getSheetByName('WeekTracker')._rows().flat().join('\n');
    expect(landingText).toContain('Для первого запуска');
    expect(landingText).toContain('Новое развертывание');
    expect(landingText).toContain('Веб-приложение');
    expect(landingText).not.toContain('После развертывания Web App используйте меню');
  });

  test('keeps date-only columns in plain-text format in bound mode', () => {
    const bound = createSpreadsheet('bound-id');
    const environment = createSetupEnvironment({ activeSpreadsheet: bound });

    environment.setupProject();

    expect(bound.getSheetByName('APP_Settings')._formats).toContainEqual({ range: 'B:B', format: '@' });
    expect(bound.getSheetByName('APP_Tasks')._formats).toContainEqual({ range: 'A:A', format: '@' });
    expect(bound.getSheetByName('APP_HabitLog')._formats).toContainEqual({ range: 'A:A', format: '@' });
  });

  test('is idempotent and does not duplicate required sheets', () => {
    const bound = createSpreadsheet('bound-id');
    const environment = createSetupEnvironment({ activeSpreadsheet: bound });

    environment.setupProject();
    environment.setupProject();

    expect(bound.getSheets().filter(sheet => systemSheets.includes(sheet.getName()))).toHaveLength(4);
    expect(bound.getSheets().filter(sheet => sheet.getName() === 'WeekTracker')).toHaveLength(1);
  });

  test('keeps the landing sheet ready when a valid WEB_APP_URL already exists', () => {
    const bound = createSpreadsheet('bound-id');
    const environment = createSetupEnvironment({
      activeSpreadsheet: bound,
      webAppUrl: [
        'https://script.google.com/macros/s/',
        'ready-deployment-id',
        '/exec',
      ].join(''),
    });

    environment.setupProject();
    environment.setupProject();

    const landingText = bound.getSheetByName('WeekTracker')._rows().flat().join('\n');
    expect(landingText).toContain('WeekTracker настроен и готов к работе');
    expect(landingText).not.toContain('Для первого запуска');
  });

  test('creates a separate data spreadsheet when there is no active spreadsheet', () => {
    const environment = createSetupEnvironment();

    expect(environment.setupProject()).toBe('spreadsheet-url-standalone-id');
    expect(environment.created).toEqual(['WeekTracker Data']);
    expect(environment.properties.SPREADSHEET_ID).toBe('standalone-id');
    expect(systemSheets.every(name => environment.standaloneSpreadsheet.getSheetByName(name))).toBe(true);
  });
});
