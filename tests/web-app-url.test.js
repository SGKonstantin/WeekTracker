import { describe, expect, test } from 'vitest';
import loader from './helpers/loadAppsScript.js';

const validWebAppUrl = () => [
  'https://script.google.com/macros/s/',
  'web-context-deployment-id',
  '/exec',
].join('');

function createWebAppEnvironment(serviceUrl, {
  landingUpdateThrows = false,
  existingWebAppUrl = null,
  spreadsheetId = 'spreadsheet-id',
} = {}) {
  const properties = {
    ...(spreadsheetId ? { SPREADSHEET_ID: spreadsheetId } : {}),
    ...(existingWebAppUrl ? { WEB_APP_URL: existingWebAppUrl } : {}),
  };
  let rendered = false;
  let landingRows = [];
  let landingUpdates = 0;
  let outputHtml = '';
  const PropertiesService = {
    getScriptProperties: () => ({
      getProperty: key => properties[key] ?? null,
      setProperty: (key, value) => { properties[key] = value; },
    }),
  };
  const ScriptApp = {
    getService: () => ({
      getUrl: () => {
        if (serviceUrl instanceof Error) throw serviceUrl;
        return serviceUrl;
      },
    }),
  };
  const SpreadsheetApp = {
    openById: () => {
      if (landingUpdateThrows) throw new Error('Landing sheet unavailable');
      return {
        getSheetByName: name => name === 'WeekTracker' ? {
          clear: () => { landingRows = []; landingUpdates += 1; },
          getRange: rowOrA1 => {
            const row = Number(/^A(\d+)/.exec(String(rowOrA1))?.[1] || 1);
            const range = {
              setValue: value => { landingRows[row - 1] = [value]; return range; },
              setFontSize: () => range,
              setFontWeight: () => range,
              setWrap: () => range,
            };
            return range;
          },
          showSheet: () => {},
          setColumnWidth: () => {},
        } : null,
      };
    },
  };
  const output = {
    setTitle() { return this; },
    setXFrameOptionsMode() { return this; },
  };
  const HtmlService = {
    XFrameOptionsMode: { ALLOWALL: 'ALLOWALL' },
    createHtmlOutput: html => {
      outputHtml = html;
      return output;
    },
    createTemplateFromFile: () => ({
      evaluate: () => {
        rendered = true;
        return output;
      },
    }),
  };
  const functions = loader.loadAppsScript({ PropertiesService, ScriptApp, SpreadsheetApp, HtmlService });
  return {
    properties,
    wasRendered: () => rendered,
    getLandingText: () => landingRows.flat().join('\n'),
    getLandingUpdates: () => landingUpdates,
    getOutputHtml: () => outputHtml,
    ...functions,
  };
}

describe('Web App URL auto-registration', () => {
  test('doGet directs an unconfigured bound user to Initial setup in the Sheet menu', () => {
    const environment = createWebAppEnvironment(null, { spreadsheetId: null });

    environment.doGet();

    expect(environment.getOutputHtml()).toContain('WeekTracker ещё не настроен');
    expect(environment.getOutputHtml()).toContain('Первоначальная настройка');
    expect(environment.getOutputHtml()).toContain('Для обычной установки');
    expect(environment.getOutputHtml()).not.toContain(
      'Откройте редактор Apps Script, выберите функцию'
    );
  });

  test('doGet stores a valid service URL from Web App execution context', () => {
    const url = validWebAppUrl();
    const environment = createWebAppEnvironment(url);

    expect(() => environment.doGet()).not.toThrow();

    expect(environment.properties.WEB_APP_URL).toBe(url);
    expect(environment.wasRendered()).toBe(true);
    expect(environment.getLandingText()).toContain('WeekTracker настроен и готов к работе');
  });

  test.each([null, 'https://example.com/exec'])('doGet ignores invalid service URL and still renders: %s', serviceUrl => {
    const environment = createWebAppEnvironment(serviceUrl);

    expect(() => environment.doGet()).not.toThrow();

    expect(environment.properties.WEB_APP_URL).toBeUndefined();
    expect(environment.wasRendered()).toBe(true);
  });

  test('doGet still renders when service URL lookup throws', () => {
    const environment = createWebAppEnvironment(new Error('Service URL unavailable'));

    expect(() => environment.doGet()).not.toThrow();

    expect(environment.properties.WEB_APP_URL).toBeUndefined();
    expect(environment.wasRendered()).toBe(true);
  });

  test('landing update failure does not break URL registration or doGet rendering', () => {
    const url = validWebAppUrl();
    const environment = createWebAppEnvironment(url, { landingUpdateThrows: true });

    expect(() => environment.doGet()).not.toThrow();

    expect(environment.properties.WEB_APP_URL).toBe(url);
    expect(environment.wasRendered()).toBe(true);
  });

  test('doGet does not rewrite a ready landing when the same URL is already registered', () => {
    const url = validWebAppUrl();
    const environment = createWebAppEnvironment(url, { existingWebAppUrl: url });

    environment.doGet();

    expect(environment.getLandingUpdates()).toBe(0);
    expect(environment.wasRendered()).toBe(true);
  });
});
