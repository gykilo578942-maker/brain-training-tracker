export function computePeriodStats(dateStrings, logsByDate, activityIds) {
  const perActivity = {};
  const total = dateStrings.length;

  for (const id of activityIds) {
    let done = 0;
    for (const dateStr of dateStrings) {
      const log = logsByDate.get(dateStr);
      if (log && log.entries && log.entries[id] && log.entries[id].done) {
        done++;
      }
    }
    perActivity[id] = { done, total, rate: total ? done / total : 0 };
  }

  const rates = Object.values(perActivity).map((a) => a.rate);
  const overall = rates.length ? rates.reduce((sum, r) => sum + r, 0) / rates.length : 0;

  return { perActivity, overall };
}

export function getDoneDates(logsByDate) {
  const doneDates = [];
  for (const [dateStr, log] of logsByDate) {
    const anyDone = log && log.entries && Object.values(log.entries).some((e) => e.done);
    if (anyDone) doneDates.push(dateStr);
  }
  return doneDates.sort();
}
