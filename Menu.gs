function getWeekTrackerUi_() {
  try {
    return SpreadsheetApp.getUi();
  } catch (error) {
    return null;
  }
}

function onOpen() {
  const ui = getWeekTrackerUi_();
  if (!ui) return;

  ui.createMenu('WeekTracker')
    .addItem('Открыть приложение', 'openWeekTrackerFromMenu')
    .addSeparator()
    .addItem('Первоначальная настройка', 'setupWeekTrackerFromMenu')
    .addItem('Указать ссылку Web App', 'setWeekTrackerWebAppUrlFromMenu')
    .addItem('О проекте', 'showWeekTrackerAbout')
    .addToUi();
}

function setupWeekTrackerFromMenu() {
  const spreadsheetUrl = setupProject();
  const ui = getWeekTrackerUi_();

  if (ui) {
    ui.alert('Первоначальная настройка WeekTracker завершена.');
  }

  return spreadsheetUrl;
}

function openWeekTrackerFromMenu() {
  const ui = getWeekTrackerUi_();
  if (!ui) return null;

  const webAppUrl = getWeekTrackerWebAppUrl_();
  if (!webAppUrl) {
    ui.alert(
      'Ссылка на WeekTracker ещё не зарегистрирована.\n' +
      'Откройте Web App URL из окна развертывания один раз или укажите его вручную.'
    );
    return null;
  }

  const safeUrl = escapeWeekTrackerHtml_(webAppUrl);
  const html = HtmlService.createHtmlOutput(
    '<div style="font-family:Arial,sans-serif;padding:16px">' +
      '<p>WeekTracker готов к работе.</p>' +
      '<a href="' + safeUrl + '" target="_blank" rel="noopener noreferrer" ' +
        'style="display:inline-block;padding:10px 16px;background:#1a73e8;color:#fff;' +
        'text-decoration:none;border-radius:4px">Открыть WeekTracker</a>' +
    '</div>'
  ).setWidth(380).setHeight(150);

  ui.showModalDialog(html, 'WeekTracker готов');
  return webAppUrl;
}

function setWeekTrackerWebAppUrlFromMenu() {
  const ui = getWeekTrackerUi_();
  if (!ui) return false;

  const response = ui.prompt(
    'Указать ссылку Web App',
    'Вставьте Web App URL из окна Deploy → Manage deployments.',
    ui.ButtonSet.OK_CANCEL
  );

  if (response.getSelectedButton() !== ui.Button.OK) return false;

  if (!saveWeekTrackerWebAppUrl_(response.getResponseText())) {
    ui.alert('Некорректная ссылка. Нужен HTTPS URL Google Apps Script Web App, заканчивающийся на /exec.');
    return false;
  }

  updateWeekTrackerLandingReady_();
  ui.alert('Ссылка Web App сохранена.');
  return true;
}

function showWeekTrackerAbout() {
  const ui = getWeekTrackerUi_();
  if (!ui) return;

  ui.alert(
    'WeekTracker\n\n' +
    'Бесплатный open-source недельный планировщик\n' +
    'и трекер привычек.'
  );
}

function escapeWeekTrackerHtml_(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function isValidWeekTrackerWebAppUrl_(value) {
  const url = String(value || '').trim();
  return /^https:\/\/script\.google\.com\/macros\/s\/[A-Za-z0-9_-]+\/exec$/.test(url);
}

function saveWeekTrackerWebAppUrl_(value) {
  const url = String(value || '').trim();
  if (!isValidWeekTrackerWebAppUrl_(url)) return false;

  PropertiesService.getScriptProperties().setProperty('WEB_APP_URL', url);
  return true;
}

function getWeekTrackerWebAppUrl_() {
  const url = PropertiesService.getScriptProperties().getProperty('WEB_APP_URL') || '';
  return isValidWeekTrackerWebAppUrl_(url) ? String(url).trim() : '';
}

function registerWeekTrackerWebAppUrl_() {
  try {
    const serviceUrl = String(ScriptApp.getService().getUrl() || '').trim();
    if (!isValidWeekTrackerWebAppUrl_(serviceUrl)) return false;

    if (getWeekTrackerWebAppUrl_() === serviceUrl) return true;
    if (!saveWeekTrackerWebAppUrl_(serviceUrl)) return false;

    updateWeekTrackerLandingReady_();
    return true;
  } catch (error) {
    return false;
  }
}
