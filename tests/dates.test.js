import { beforeAll, describe, expect, test } from 'vitest';
import loader from './helpers/loadAppsScript.js';

let normalizeDateIso_;
let mondayIso_;
let addDaysIso_;

beforeAll(() => {
  ({ normalizeDateIso_, mondayIso_, addDaysIso_ } = loader.loadAppsScript());
});

describe('normalizeDateIso_', () => {
  test.each([
    ['ISO date string', '2026-08-15', '2026-08-15'],
    ['Russian date string', '15.08.2026', '2026-08-15'],
    ['Google Sheets serial number', 46249, '2026-08-15'],
    ['Google Sheets serial string', '46249', '2026-08-15'],
    ['UTC Date', new Date(Date.UTC(2026, 7, 15)), '2026-08-15'],
    ['empty string', '', ''],
    ['invalid string', 'definitely-not-a-date', ''],
  ])('%s', (_scenario, input, expected) => {
    expect(normalizeDateIso_(input)).toBe(expected);
  });
});

describe('mondayIso_', () => {
  test.each([
    ['2026-08-10', '2026-08-10'],
    ['2026-08-15', '2026-08-10'],
    ['2026-08-16', '2026-08-10'],
  ])('%s -> %s', (input, expected) => {
    expect(mondayIso_(input)).toBe(expected);
  });
});

describe('addDaysIso_', () => {
  test.each([
    ['2026-08-10', 0, '2026-08-10'],
    ['2026-08-10', 6, '2026-08-16'],
  ])('%s plus %i days -> %s', (input, days, expected) => {
    expect(addDaysIso_(input, days)).toBe(expected);
  });
});
