import { test } from "node:test";
import assert from "node:assert/strict";
import { formatDate, parseDate, addDays, getRangeDates, calcStreak } from "../src/date-utils.js";

test("formatDate pads month and day with zeros", () => {
  assert.equal(formatDate(new Date(2024, 0, 5)), "2024-01-05");
});

test("parseDate parses YYYY-MM-DD into a local Date", () => {
  const d = parseDate("2024-03-05");
  assert.equal(d.getFullYear(), 2024);
  assert.equal(d.getMonth(), 2);
  assert.equal(d.getDate(), 5);
});

test("addDays shifts date forward and backward across month boundaries", () => {
  const d = new Date(2024, 0, 31);
  assert.equal(formatDate(addDays(d, 1)), "2024-02-01");
  assert.equal(formatDate(addDays(d, -31)), "2023-12-31");
});

test('getRangeDates("week") returns Monday..reference for a mid-week reference date', () => {
  const dates = getRangeDates("week", new Date(2024, 0, 10)); // Wed Jan 10 2024
  assert.deepEqual(dates, ["2024-01-08", "2024-01-09", "2024-01-10"]);
});

test('getRangeDates("month") returns the 1st..reference date, capped at reference date', () => {
  const dates = getRangeDates("month", new Date(2024, 2, 5)); // Mar 5 2024
  assert.deepEqual(dates, ["2024-03-01", "2024-03-02", "2024-03-03", "2024-03-04", "2024-03-05"]);
});

test('getRangeDates("year") returns Jan 1..reference date, capped at reference date', () => {
  const dates = getRangeDates("year", new Date(2024, 2, 5)); // Mar 5 2024 (2024 is a leap year)
  assert.equal(dates.length, 65); // 31 (Jan) + 29 (Feb) + 5 (Mar)
  assert.equal(dates[0], "2024-01-01");
  assert.equal(dates[dates.length - 1], "2024-03-05");
});

test("getRangeDates throws on an unknown period", () => {
  assert.throws(() => getRangeDates("decade", new Date(2024, 0, 1)));
});

test("calcStreak counts consecutive days ending on the reference date", () => {
  const { current, longest } = calcStreak(
    ["2024-01-08", "2024-01-09", "2024-01-10"],
    new Date(2024, 0, 10)
  );
  assert.equal(current, 3);
  assert.equal(longest, 3);
});

test("calcStreak gives grace when the reference date itself is not yet logged", () => {
  const { current } = calcStreak(["2024-01-08", "2024-01-09"], new Date(2024, 0, 10));
  assert.equal(current, 2);
});

test("calcStreak breaks the current streak when yesterday is missing", () => {
  const { current, longest } = calcStreak(["2024-01-05", "2024-01-06"], new Date(2024, 0, 10));
  assert.equal(current, 0);
  assert.equal(longest, 2);
});

test("calcStreak finds the longest historical streak even if the current one is shorter", () => {
  const { current, longest } = calcStreak(
    ["2024-01-01", "2024-01-02", "2024-01-03", "2024-01-04", "2024-01-18"],
    new Date(2024, 0, 20)
  );
  assert.equal(current, 0);
  assert.equal(longest, 4);
});
