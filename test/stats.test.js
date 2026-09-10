import { test } from "node:test";
import assert from "node:assert/strict";
import { computePeriodStats, getDoneDates } from "../src/stats.js";

function buildLogsMap(rows) {
  return new Map(rows.map(([date, entries]) => [date, { entries }]));
}

test("computePeriodStats computes per-activity done count and rate", () => {
  const logs = buildLogsMap([
    ["2024-01-01", { run: { done: true, memo: "" }, chess: { done: false, memo: "" } }],
    ["2024-01-02", { run: { done: false, memo: "" }, chess: { done: true, memo: "" } }],
    ["2024-01-03", { run: { done: true, memo: "" }, chess: { done: true, memo: "" } }],
  ]);
  const dates = ["2024-01-01", "2024-01-02", "2024-01-03"];

  const { perActivity, overall } = computePeriodStats(dates, logs, ["run", "chess"]);

  assert.deepEqual(perActivity.run, { done: 2, total: 3, rate: 2 / 3 });
  assert.deepEqual(perActivity.chess, { done: 2, total: 3, rate: 2 / 3 });
  assert.equal(overall, 2 / 3);
});

test("computePeriodStats treats missing log documents and missing entries as not done", () => {
  const logs = buildLogsMap([["2024-01-01", { run: { done: true, memo: "" } }]]);
  const dates = ["2024-01-01", "2024-01-02"];

  const { perActivity } = computePeriodStats(dates, logs, ["run"]);

  assert.deepEqual(perActivity.run, { done: 1, total: 2, rate: 0.5 });
});

test("computePeriodStats returns zero rates for an empty date range", () => {
  const logs = buildLogsMap([]);
  const { perActivity, overall } = computePeriodStats([], logs, ["run"]);

  assert.deepEqual(perActivity.run, { done: 0, total: 0, rate: 0 });
  assert.equal(overall, 0);
});

test("getDoneDates returns sorted dates where at least one activity was done", () => {
  const logs = buildLogsMap([
    ["2024-01-03", { run: { done: false } }],
    ["2024-01-01", { run: { done: true } }],
    ["2024-01-02", { run: { done: false }, chess: { done: true } }],
  ]);

  assert.deepEqual(getDoneDates(logs), ["2024-01-01", "2024-01-02"]);
});
