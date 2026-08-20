import { describe, expect, test } from 'vitest';
import loader from './helpers/loadAppsScript.js';

const validWebAppUrl = () => [
  'https://script.google.com/macros/s/',
  'test-deployment-id',
  '/exec',
].join('');

function createMenuEnvironment({
  hasUi = true,
  serviceUrl = null,
  webAppUrl = null,
  promptText = '',
  promptConfirmed = true,
} = {}) {
  const menuItems = [];
  const alerts = [];
  const dialogs = [];
  const properties = {
    SPREADSHEET_ID: 'bound-id',
    ...(webAppUrl ? { WEB_APP_URL: webAppUrl } : {}),
  };
  let landingRows = [];
  let serviceUrlReads = 0;
  const menu = {
    addItem: (label, handler) => { menuItems.push({ label, handler }); return menu; },
    addSeparator: () => { menuItems.push({ separator: true }); return menu; },
    addToUi: () => { menuItems.push({ added: true }); },
  };
  const ui = {
    Button: { OK: 'OK', CANCEL: 'CANCEL' },
    ButtonSet: { OK_CANCEL: 'OK_CANCEL' },
    createMenu: label => { menuItems.push({ menu: label }); return menu; },
    alert: message => { alerts.push(message); },
    prompt: () => ({
      getSelectedButton: () => promptConfirmed ? 'OK' : 'CANCEL',
      getResponseText: () => promptText,
    }),
    showModalDialog: (html, title) => { dialogs.push({ html, title }); },
  };
  const SpreadsheetApp = {
    getUi: () => {
      if (!hasUi) throw new Error('No spreadsheet UI');
      return ui;
    },
    openById: () => ({
      getSheetByName: name => name === 'WeekTracker' ? {
        clear: () => { landingRows = []; },
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
    }),
  };
  const ScriptApp = {
    getService: () => ({
      getUrl: () => {
        serviceUrlReads += 1;
        return serviceUrl;
      },
    }),
  };
  const PropertiesService = {
    getScriptProperties: () => ({
      getProperty: key => properties[key] ?? null,
      setProperty: (key, value) => { properties[key] = value; },
    }),
  };
  const HtmlService = {
    createHtmlOutput: html => ({
      html,
      setWidth() { return this; },
      setHeight() { return this; },
    }),
  };
  const functions = loader.loadAppsScript({ SpreadsheetApp, ScriptApp, PropertiesService, HtmlService });
  return {
    menuItems,
    alerts,
    dialogs,
    properties,
    getServiceUrlReads: () => serviceUrlReads,
    getLandingText: () => landingRows.flat().join('\n'),
    ...functions,
  };
}

describe('bound spreadsheet menu', () => {
  test('creates the WeekTracker menu with expected actions', () => {
    const environment = createMenuEnvironment();

    environment.onOpen();

    expect(environment.menuItems).toContainEqual({ menu: 'WeekTracker' });
    expect(environment.menuItems).toContainEqual({ label: 'Открыть приложение', handler: 'openWeekTrackerFromMenu' });
    expect(environment.menuItems).toContainEqual({ label: 'Первоначальная настройка', handler: 'setupWeekTrackerFromMenu' });
    expect(environment.menuItems).toContainEqual({
      label: 'Указать ссылку Web App',
      handler: 'setWeekTrackerWebAppUrlFromMenu',
    });
    expect(environment.menuItems).toContainEqual({ label: 'О проекте', handler: 'showWeekTrackerAbout' });
  });

  test('does nothing safely when spreadsheet UI is unavailable', () => {
    const environment = createMenuEnvironment({ hasUi: false });

    expect(() => environment.onOpen()).not.toThrow();
  });

  test('uses registered WEB_APP_URL and never reads the service URL from menu context', () => {
    const registeredUrl = validWebAppUrl();
    const environment = createMenuEnvironment({
      webAppUrl: registeredUrl,
      serviceUrl: 'wrong-menu-context-url',
    });

    environment.openWeekTrackerFromMenu();

    expect(environment.getServiceUrlReads()).toBe(0);
    expect(environment.dialogs).toHaveLength(1);
    expect(environment.dialogs[0].title).toBe('WeekTracker готов');
    expect(environment.dialogs[0].html.html).toContain(registeredUrl);
    expect(environment.dialogs[0].html.html).not.toContain('wrong-menu-context-url');
    expect(environment.dialogs[0].html.html).toContain('target="_blank"');
  });

  test('does not create a link without WEB_APP_URL and explains initial registration', () => {
    const environment = createMenuEnvironment({ serviceUrl: 'wrong-menu-context-url' });

    environment.openWeekTrackerFromMenu();

    expect(environment.getServiceUrlReads()).toBe(0);
    expect(environment.dialogs).toHaveLength(0);
    expect(environment.alerts.join(' ')).toContain(
      'Откройте Web App URL из окна развертывания один раз или укажите его вручную.'
    );
  });

  test.each([
    'javascript:alert(1)',
    'https://example.com/exec',
    ['https://script.google.com/macros/s/', 'test-deployment-id', '/dev'].join(''),
    ['http://script.google.com/macros/s/', 'test-deployment-id', '/exec'].join(''),
  ])('rejects invalid Web App URL: %s', invalidUrl => {
    const environment = createMenuEnvironment();

    expect(environment.saveWeekTrackerWebAppUrl_(invalidUrl)).toBe(false);
    expect(environment.properties.WEB_APP_URL).toBeUndefined();
  });

  test('manual fallback saves a valid canonical Web App URL', () => {
    const url = validWebAppUrl();
    const environment = createMenuEnvironment({ promptText: `  ${url}  ` });

    environment.setWeekTrackerWebAppUrlFromMenu();

    expect(environment.properties.WEB_APP_URL).toBe(url);
    expect(environment.alerts.join(' ')).toContain('Ссылка Web App сохранена');
    expect(environment.getLandingText()).toContain('WeekTracker настроен и готов к работе');
  });
});
