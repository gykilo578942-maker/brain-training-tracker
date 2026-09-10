# 脳トレ管理アプリ Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a personal, single-user PWA that records daily completion of six brain-training activities, shows week/month/year completion-rate stats, and can be installed to an iPhone home screen via GitHub Pages + Firebase.

**Architecture:** A dependency-free static site (HTML/CSS/ES modules) hosted on GitHub Pages. Firebase Authentication (email/password, one user) gates access; Firebase Firestore stores activities and daily logs under `users/{uid}/...`. A service worker caches the app shell for offline/installed use. Pure date/stats logic lives in separate modules covered by Node's built-in test runner; UI wiring and Firebase calls are verified manually in a browser, since they require a live Firebase project and DOM.

**Tech Stack:** Vanilla JS (ES modules, no bundler/framework), Firebase JS SDK v10 (loaded via `gstatic.com` CDN URL imports), Node.js built-in test runner (`node --test`) for pure-logic unit tests, GitHub Pages for hosting.

**Spec:** `docs/superpowers/specs/2026-09-10-brain-training-tracker-design.md`

## Global Constraints

- Single user only — no multi-user/sharing logic anywhere.
- No build step, no npm dependencies for the shipped app — everything runs directly in the browser from static files.
- All Firestore access is scoped to `users/{uid}/...` and enforced by the security rules in Task 9.
- Firebase config values (already collected, non-secret):
  ```js
  const firebaseConfig = {
    apiKey: "AIzaSyB9lPb-I6I4RRGO9s-wNPvp1s3u8Nr4-hI",
    authDomain: "brain-training-tracker.firebaseapp.com",
    projectId: "brain-training-tracker",
    storageBucket: "brain-training-tracker.firebasestorage.app",
    messagingSenderId: "768684319007",
    appId: "1:768684319007:web:c0eea618fb06f68fd7502a",
  };
  ```
- Firebase JS SDK version pinned to `10.14.1` via CDN URL imports (`https://www.gstatic.com/firebasejs/10.14.1/firebase-*.js`). If a task's implementer finds this version no longer served, substitute the current stable v10 release from https://firebase.google.com/docs/web/setup and use the same version consistently across every file that imports it.
- Default activities (seeded once, on first login, into Firestore — never hardcoded into UI logic beyond the seed step): 🏃 ランニング・筋トレ, 🧘 瞑想, 🎸 楽器の練習, 📖 速読トレーニング, 🗣️ 英語学習, ♟️ チェスの練習.
- Local manual testing uses `npx serve .` (or any static file server) from the project root — service workers and ES modules do not work reliably over `file://`.

---

### Task 1: Project scaffold

**Files:**
- Create: `package.json`
- Create: `.gitignore`
- Create: `index.html`
- Create: `styles.css`
- Create: `firestore.rules`

**Interfaces:**
- Produces: the DOM ids/classes every later task's JS attaches to (`screen-login`, `screen-today`, `screen-stats`, `screen-manage`, `main-nav`, and the form/list ids listed below). Later tasks treat these ids as fixed.

- [ ] **Step 1: Create `package.json`**

```json
{
  "name": "brain-training-tracker",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "test": "node --test test/"
  }
}
```

- [ ] **Step 2: Create `.gitignore`**

```
node_modules/
.DS_Store
```

- [ ] **Step 3: Create `index.html`**

```html
<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
  <title>脳トレ管理アプリ</title>
  <link rel="stylesheet" href="styles.css" />
</head>
<body>
  <main id="app">
    <section id="screen-login" class="screen">
      <h1>脳トレ管理アプリ</h1>
      <form id="login-form">
        <input type="email" id="login-email" placeholder="メールアドレス" required />
        <input type="password" id="login-password" placeholder="パスワード" required />
        <button type="submit">ログイン</button>
      </form>
      <p id="login-error" class="error" hidden></p>
    </section>

    <section id="screen-today" class="screen" hidden>
      <header>
        <h2>今日の記録</h2>
        <input type="date" id="today-date-picker" />
      </header>
      <ul id="today-activity-list"></ul>
    </section>

    <section id="screen-stats" class="screen" hidden>
      <h2>振り返り</h2>
      <div class="tabs">
        <button type="button" data-period="week" class="tab active">週</button>
        <button type="button" data-period="month" class="tab">月</button>
        <button type="button" data-period="year" class="tab">年</button>
      </div>
      <p id="stats-overall"></p>
      <p id="stats-streak"></p>
      <div id="stats-chart"></div>
    </section>

    <section id="screen-manage" class="screen" hidden>
      <h2>項目管理</h2>
      <ul id="manage-activity-list"></ul>
      <form id="add-activity-form">
        <input type="text" id="add-activity-name" placeholder="新しい項目名" required />
        <input type="text" id="add-activity-icon" placeholder="絵文字" maxlength="2" />
        <button type="submit">追加</button>
      </form>
    </section>

    <nav id="main-nav" hidden>
      <button type="button" data-screen="today">今日</button>
      <button type="button" data-screen="stats">振り返り</button>
      <button type="button" data-screen="manage">項目管理</button>
      <button type="button" id="logout-button">ログアウト</button>
    </nav>
  </main>
</body>
</html>
```

- [ ] **Step 4: Create `styles.css`**

```css
:root {
  --bg: #fdfdfd;
  --fg: #222;
  --accent: #3d405b;
  --border: #ddd;
}

* { box-sizing: border-box; }

body {
  margin: 0;
  font-family: system-ui, -apple-system, "Hiragino Sans", sans-serif;
  background: var(--bg);
  color: var(--fg);
  padding-bottom: 72px;
}

#app { max-width: 480px; margin: 0 auto; padding: 16px; }

.screen[hidden] { display: none; }

h1, h2 { color: var(--accent); }

form { display: flex; flex-direction: column; gap: 8px; }

input, button {
  font-size: 16px;
  padding: 8px;
  border: 1px solid var(--border);
  border-radius: 6px;
}

button { background: var(--accent); color: white; border: none; cursor: pointer; }

.error { color: #b00020; }

#today-activity-list, #manage-activity-list { list-style: none; padding: 0; }

#today-activity-list li, #manage-activity-list li {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 0;
  border-bottom: 1px solid var(--border);
  flex-wrap: wrap;
}

.tabs { display: flex; gap: 8px; margin-bottom: 12px; }

.tab { flex: 1; background: white; color: var(--accent); border: 1px solid var(--accent); }

.tab.active { background: var(--accent); color: white; }

.chart-row { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; }

.chart-label { flex: 0 0 40%; font-size: 14px; }

.chart-bar-track { flex: 1; background: #eee; border-radius: 4px; height: 12px; overflow: hidden; }

.chart-bar-fill { height: 100%; }

.chart-value { flex: 0 0 auto; font-size: 12px; color: #666; }

#main-nav {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  display: flex;
  background: white;
  border-top: 1px solid var(--border);
}

#main-nav[hidden] { display: none; }

#main-nav button {
  flex: 1;
  background: none;
  color: var(--accent);
  border-radius: 0;
  padding: 12px 4px;
}
```

- [ ] **Step 5: Create `firestore.rules`** (not deployed yet — deployed in Task 9)

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{uid}/{document=**} {
      allow read, write: if request.auth != null && request.auth.uid == uid;
    }
  }
}
```

- [ ] **Step 6: Manual verification**

Open `index.html` directly in a browser (double-click it, or `npx serve .` and visit the shown URL). Confirm the login form renders and no other section is visible. No console errors expected (no scripts are wired up yet).

- [ ] **Step 7: Commit**

```bash
git add package.json .gitignore index.html styles.css firestore.rules
git commit -m "Scaffold project structure and static markup"
```

---

### Task 2: `src/date-utils.js` — pure date helpers (TDD)

**Files:**
- Create: `src/date-utils.js`
- Test: `test/date-utils.test.js`

**Interfaces:**
- Produces: `formatDate(date: Date): string`, `parseDate(dateStr: string): Date`, `addDays(date: Date, days: number): Date`, `getRangeDates(period: 'week'|'month'|'year', referenceDate?: Date): string[]`, `calcStreak(doneDates: string[], referenceDate?: Date): {current: number, longest: number}`. Consumed by `src/app.js` (Task 5+) and `src/stats.js` usage sites in `app.js` (Task 7).

- [ ] **Step 1: Write the failing tests**

Create `test/date-utils.test.js`:

```js
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test test/date-utils.test.js`
Expected: FAIL — `src/date-utils.js` does not exist yet.

- [ ] **Step 3: Implement `src/date-utils.js`**

```js
export function formatDate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function parseDate(dateStr) {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(date, days) {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

export function getRangeDates(period, referenceDate = new Date()) {
  const today = new Date(referenceDate.getFullYear(), referenceDate.getMonth(), referenceDate.getDate());
  let start;
  let end;

  if (period === "week") {
    const dayOfWeek = today.getDay(); // 0=Sun..6=Sat
    const diffToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    start = addDays(today, -diffToMonday);
    end = addDays(start, 6);
  } else if (period === "month") {
    start = new Date(today.getFullYear(), today.getMonth(), 1);
    end = new Date(today.getFullYear(), today.getMonth() + 1, 0);
  } else if (period === "year") {
    start = new Date(today.getFullYear(), 0, 1);
    end = new Date(today.getFullYear(), 11, 31);
  } else {
    throw new Error(`Unknown period: ${period}`);
  }

  if (end > today) end = today;

  const dates = [];
  for (let d = new Date(start); d <= end; d = addDays(d, 1)) {
    dates.push(formatDate(d));
  }
  return dates;
}

export function calcStreak(doneDates, referenceDate = new Date()) {
  const doneSet = new Set(doneDates);
  const today = new Date(referenceDate.getFullYear(), referenceDate.getMonth(), referenceDate.getDate());

  let current = 0;
  let cursor = doneSet.has(formatDate(today)) ? today : addDays(today, -1);
  while (doneSet.has(formatDate(cursor))) {
    current++;
    cursor = addDays(cursor, -1);
  }

  const sortedDates = [...doneSet].sort();
  let longest = 0;
  let run = 0;
  let prev = null;
  for (const dateStr of sortedDates) {
    if (prev !== null && formatDate(addDays(parseDate(prev), 1)) === dateStr) {
      run++;
    } else {
      run = 1;
    }
    longest = Math.max(longest, run);
    prev = dateStr;
  }

  return { current, longest };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test test/date-utils.test.js`
Expected: all tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/date-utils.js test/date-utils.test.js
git commit -m "Add pure date-range and streak helpers with tests"
```

---

### Task 3: `src/stats.js` — completion-rate calculations (TDD)

**Files:**
- Create: `src/stats.js`
- Test: `test/stats.test.js`

**Interfaces:**
- Consumes: nothing (pure functions, no imports from Task 2).
- Produces: `computePeriodStats(dateStrings: string[], logsByDate: Map<string, {entries: Record<string, {done: boolean, memo: string}>}>, activityIds: string[]): {perActivity: Record<string, {done: number, total: number, rate: number}>, overall: number}` and `getDoneDates(logsByDate: Map<string, {entries: ...}>): string[]`. Both consumed by `src/app.js` in Task 7 (`getDoneDates` result feeds `calcStreak` from Task 2).

- [ ] **Step 1: Write the failing tests**

Create `test/stats.test.js`:

```js
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test test/stats.test.js`
Expected: FAIL — `src/stats.js` does not exist yet.

- [ ] **Step 3: Implement `src/stats.js`**

```js
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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test test/stats.test.js`
Expected: all tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/stats.js test/stats.test.js
git commit -m "Add completion-rate stats calculation with tests"
```

---

### Task 4: App icons + manifest + head meta tags

**Files:**
- Create: `tools/icon-source.html`
- Create: `icons/icon-192.png`
- Create: `icons/icon-512.png`
- Create: `manifest.json`
- Modify: `index.html` (`<head>` section)

**Interfaces:**
- Produces: `icons/icon-192.png`, `icons/icon-512.png` referenced by `manifest.json` and by the `apple-touch-icon` link in `index.html`. No JS interface.

- [ ] **Step 1: Create the icon source page**

Create `tools/icon-source.html`:

```html
<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<style>
  html, body { margin: 0; padding: 0; }
  .icon {
    width: 100vw;
    height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    background: #3d405b;
    font-size: 62vw;
  }
</style>
</head>
<body><div class="icon">🧠</div></body>
</html>
```

- [ ] **Step 2: Render it to PNG at both sizes**

Using the Playwright browser tool: navigate to the local `tools/icon-source.html` file, set the viewport to 512x512, take a screenshot and save it as `icons/icon-512.png`; then set the viewport to 192x192, reload the same page, take a screenshot and save it as `icons/icon-192.png`. The `.icon` div uses viewport-relative units (`100vw`/`100vh`/`62vw`), so the emoji scales correctly at both sizes without editing the source file between screenshots.

- [ ] **Step 3: Verify the icons**

Open both PNG files and confirm each is square, fills the frame edge-to-edge with the dark background, and shows the 🧠 emoji centered with no white border.

- [ ] **Step 4: Create `manifest.json`**

```json
{
  "name": "脳トレ管理アプリ",
  "short_name": "脳トレ管理",
  "start_url": "./index.html",
  "scope": "./",
  "display": "standalone",
  "background_color": "#fdfdfd",
  "theme_color": "#3d405b",
  "icons": [
    { "src": "icons/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "icons/icon-512.png", "sizes": "512x512", "type": "image/png" }
  ]
}
```

- [ ] **Step 5: Wire it into `index.html`**

In `index.html`, inside `<head>`, right after the `<title>` line, add:

```html
  <link rel="manifest" href="manifest.json" />
  <link rel="apple-touch-icon" href="icons/icon-192.png" />
  <meta name="apple-mobile-web-app-capable" content="yes" />
  <meta name="apple-mobile-web-app-status-bar-style" content="default" />
  <meta name="theme-color" content="#3d405b" />
```

- [ ] **Step 6: Manual verification**

Run `npx serve .` and open the shown URL in a desktop browser's DevTools → Application tab (or equivalent). Confirm the manifest loads with no errors and both icon sizes resolve.

- [ ] **Step 7: Commit**

```bash
git add tools/icon-source.html icons/icon-192.png icons/icon-512.png manifest.json index.html
git commit -m "Add PWA manifest and app icons"
```

---

### Task 5: Firebase config, auth, and app bootstrap (login/logout)

**Files:**
- Create: `src/firebase-config.js`
- Create: `src/auth.js`
- Create: `src/app.js`
- Create: `sw.js`
- Modify: `index.html` (add `<script type="module" src="src/app.js"></script>` before `</body>`)

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces: `auth` and `db` exports from `firebase-config.js` (consumed by `src/db.js` in Task 6); `login(email, password)`, `logout()`, `onAuthChange(callback)`, `getCurrentUser()` from `auth.js` (consumed only by `app.js`). `app.js` establishes `showScreen(name)` and the `screens`/`mainNav` bootstrap that Tasks 6–8 extend.

- [ ] **Step 1: Create a Firebase user account (one-time, manual, in the Firebase console)**

In the Firebase console for the `brain-training-tracker` project, go to Authentication → Users → "Add user", and create the one account (email + password) that will log into this app. There is no sign-up screen in the app on purpose — this is a single-user app and the account is provisioned out-of-band.

- [ ] **Step 2: Create `src/firebase-config.js`**

```js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";
import { getAuth, setPersistence, browserLocalPersistence } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";
import { getFirestore, enableIndexedDbPersistence } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyB9lPb-I6I4RRGO9s-wNPvp1s3u8Nr4-hI",
  authDomain: "brain-training-tracker.firebaseapp.com",
  projectId: "brain-training-tracker",
  storageBucket: "brain-training-tracker.firebasestorage.app",
  messagingSenderId: "768684319007",
  appId: "1:768684319007:web:c0eea618fb06f68fd7502a",
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

setPersistence(auth, browserLocalPersistence).catch((err) => {
  console.error("Failed to set auth persistence", err);
});

enableIndexedDbPersistence(db).catch((err) => {
  console.warn("Firestore offline persistence unavailable", err.code);
});
```

- [ ] **Step 3: Create `src/auth.js`**

```js
import {
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";
import { auth } from "./firebase-config.js";

export function login(email, password) {
  return signInWithEmailAndPassword(auth, email, password);
}

export function logout() {
  return signOut(auth);
}

export function onAuthChange(callback) {
  return onAuthStateChanged(auth, callback);
}

export function getCurrentUser() {
  return auth.currentUser;
}
```

- [ ] **Step 4: Create `sw.js`**

```js
const CACHE_NAME = "bt-tracker-v1";
const APP_SHELL = [
  "./",
  "./index.html",
  "./styles.css",
  "./manifest.json",
  "./src/app.js",
  "./src/firebase-config.js",
  "./src/auth.js",
  "./src/date-utils.js",
  "./src/stats.js",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) {
    return; // let Firebase/Google API requests pass through uncached
  }
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        const copy = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});
```

Note: `src/db.js` is added to `APP_SHELL` in Task 6 when that file is created.

- [ ] **Step 5: Create `src/app.js`**

```js
import { login, logout, onAuthChange } from "./auth.js";

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => navigator.serviceWorker.register("./sw.js"));
}

const screens = {
  login: document.getElementById("screen-login"),
  today: document.getElementById("screen-today"),
  stats: document.getElementById("screen-stats"),
  manage: document.getElementById("screen-manage"),
};
const mainNav = document.getElementById("main-nav");

function showScreen(name) {
  for (const key of Object.keys(screens)) {
    screens[key].hidden = key !== name;
  }
}

let currentUser = null;

onAuthChange(async (user) => {
  currentUser = user;
  if (user) {
    mainNav.hidden = false;
    showScreen("today");
  } else {
    mainNav.hidden = true;
    showScreen("login");
  }
});

document.getElementById("login-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const email = document.getElementById("login-email").value;
  const password = document.getElementById("login-password").value;
  const errorEl = document.getElementById("login-error");
  errorEl.hidden = true;
  try {
    await login(email, password);
  } catch (err) {
    errorEl.textContent = "ログインに失敗しました。メールアドレスとパスワードを確認してください。";
    errorEl.hidden = false;
  }
});

document.getElementById("logout-button").addEventListener("click", () => logout());

mainNav.querySelectorAll("button[data-screen]").forEach((button) => {
  button.addEventListener("click", () => showScreen(button.dataset.screen));
});
```

- [ ] **Step 6: Wire the script into `index.html`**

In `index.html`, immediately before `</body>`, add:

```html
  <script type="module" src="src/app.js"></script>
```

- [ ] **Step 7: Manual verification**

Run `npx serve .`, open the shown URL, and:
1. Confirm the login form appears with no console errors.
2. Log in with the email/password created in Step 1. Confirm the "今日" screen and the bottom nav appear.
3. Click "ログアウト". Confirm it returns to the login screen.
4. Try an intentionally wrong password. Confirm the Japanese error message appears.

- [ ] **Step 8: Commit**

```bash
git add src/firebase-config.js src/auth.js src/app.js sw.js index.html
git commit -m "Wire Firebase auth, login/logout flow, and service worker"
```

---

### Task 6: `src/db.js` (activities) + Today screen

**Files:**
- Create: `src/db.js` (activities portion; logs portion added in Task 7)
- Modify: `src/app.js` (add Today-screen rendering)
- Modify: `sw.js` (add `"./src/db.js"` to `APP_SHELL`)

**Interfaces:**
- Consumes: `db` from `src/firebase-config.js` (Task 5).
- Produces (this task): `seedDefaultActivitiesIfEmpty(uid): Promise<void>`, `getActivities(uid): Promise<Array<{id, name, icon, color, order, active}>>`, `addActivity(uid, {name, icon, color, order}): Promise<string>`, `updateActivity(uid, activityId, patch): Promise<void>`, `reorderActivities(uid, orderedIds): Promise<void>`, `getLog(uid, dateStr): Promise<{entries: object}>`, `setEntry(uid, dateStr, activityId, {done, memo}): Promise<void>`, and `getLogsInRange(uid, startDateStr, endDateStr): Promise<Map<string, {entries: object}>>` (this last one is not used by Task 6's own UI code, but is consumed by the Stats screen in Task 7 — implement it in this task's `src/db.js` anyway, per the code in Step 1). `getActivities`/`addActivity`/`updateActivity`/`reorderActivities` are also consumed by the Manage screen in Task 8 (archiving reuses `updateActivity` with `{active: false}` — no separate helper).

- [ ] **Step 1: Create `src/db.js`**

```js
import {
  collection, doc, getDocs, getDoc, setDoc, updateDoc, addDoc,
  query, orderBy, where, documentId, serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";
import { db } from "./firebase-config.js";

const DEFAULT_ACTIVITIES = [
  { name: "ランニング・筋トレ", icon: "🏃", color: "#e07a5f" },
  { name: "瞑想", icon: "🧘", color: "#81b29a" },
  { name: "楽器の練習", icon: "🎸", color: "#f2cc8f" },
  { name: "速読トレーニング", icon: "📖", color: "#3d405b" },
  { name: "英語学習", icon: "🗣️", color: "#5aa9e6" },
  { name: "チェスの練習", icon: "♟️", color: "#6d597a" },
];

function activitiesRef(uid) {
  return collection(db, "users", uid, "activities");
}

export async function seedDefaultActivitiesIfEmpty(uid) {
  const snapshot = await getDocs(activitiesRef(uid));
  if (!snapshot.empty) return;

  await Promise.all(
    DEFAULT_ACTIVITIES.map((activity, index) =>
      addDoc(activitiesRef(uid), { ...activity, order: index, active: true, createdAt: serverTimestamp() })
    )
  );
}

export async function getActivities(uid) {
  const snapshot = await getDocs(query(activitiesRef(uid), orderBy("order")));
  return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function addActivity(uid, { name, icon, color, order }) {
  const docRef = await addDoc(activitiesRef(uid), {
    name, icon, color, order, active: true, createdAt: serverTimestamp(),
  });
  return docRef.id;
}

export async function updateActivity(uid, activityId, patch) {
  await updateDoc(doc(db, "users", uid, "activities", activityId), patch);
}

export async function reorderActivities(uid, orderedIds) {
  await Promise.all(orderedIds.map((id, index) => updateActivity(uid, id, { order: index })));
}

function logDocRef(uid, dateStr) {
  return doc(db, "users", uid, "logs", dateStr);
}

export async function getLog(uid, dateStr) {
  const snap = await getDoc(logDocRef(uid, dateStr));
  return snap.exists() ? snap.data() : { entries: {} };
}

export async function setEntry(uid, dateStr, activityId, { done, memo }) {
  const ref = logDocRef(uid, dateStr);
  const snap = await getDoc(ref);
  const entries = snap.exists() ? snap.data().entries || {} : {};
  entries[activityId] = { done, memo: memo || "" };
  await setDoc(ref, { entries, updatedAt: serverTimestamp() }, { merge: true });
}

export async function getLogsInRange(uid, startDateStr, endDateStr) {
  const logsRef = collection(db, "users", uid, "logs");
  const snapshot = await getDocs(
    query(logsRef, where(documentId(), ">=", startDateStr), where(documentId(), "<=", endDateStr))
  );
  const map = new Map();
  snapshot.forEach((d) => map.set(d.id, d.data()));
  return map;
}
```

- [ ] **Step 2: Add `src/db.js` to the service worker's app shell**

In `sw.js`, in the `APP_SHELL` array, add `"./src/db.js"` (any position is fine, e.g. right after `"./src/auth.js"`).

- [ ] **Step 3: Extend `src/app.js` — imports and seeding on login**

At the top of `src/app.js`, change the import line to:

```js
import { login, logout, onAuthChange } from "./auth.js";
import { seedDefaultActivitiesIfEmpty, getActivities, getLog, setEntry } from "./db.js";
import { formatDate } from "./date-utils.js";
```

Replace the `onAuthChange` handler with:

```js
let activitiesCache = [];

onAuthChange(async (user) => {
  currentUser = user;
  if (user) {
    mainNav.hidden = false;
    await seedDefaultActivitiesIfEmpty(user.uid);
    activitiesCache = await getActivities(user.uid);
    showScreen("today");
    await renderTodayScreen();
  } else {
    mainNav.hidden = true;
    showScreen("login");
  }
});
```

- [ ] **Step 4: Extend `src/app.js` — Today screen rendering**

Append to the end of `src/app.js`:

```js
const datePicker = document.getElementById("today-date-picker");
datePicker.value = formatDate(new Date());
datePicker.addEventListener("change", renderTodayScreen);

async function renderTodayScreen() {
  const dateStr = datePicker.value || formatDate(new Date());
  const log = await getLog(currentUser.uid, dateStr);
  const listEl = document.getElementById("today-activity-list");
  listEl.innerHTML = "";

  for (const activity of activitiesCache.filter((a) => a.active)) {
    const entry = log.entries[activity.id] || { done: false, memo: "" };
    const item = document.createElement("li");
    item.innerHTML = `
      <label>
        <input type="checkbox" data-activity-id="${activity.id}" ${entry.done ? "checked" : ""} />
        ${activity.icon} ${activity.name}
      </label>
      <input type="text" data-memo-id="${activity.id}" placeholder="一言メモ" value="${entry.memo}" />
    `;
    listEl.appendChild(item);
  }

  async function saveEntry(activityId) {
    const checkbox = listEl.querySelector(`input[data-activity-id="${activityId}"]`);
    const memoInput = listEl.querySelector(`input[data-memo-id="${activityId}"]`);
    await setEntry(currentUser.uid, dateStr, activityId, { done: checkbox.checked, memo: memoInput.value });
  }

  listEl.querySelectorAll("input[type=checkbox]").forEach((checkbox) => {
    checkbox.addEventListener("change", () => saveEntry(checkbox.dataset.activityId));
  });
  listEl.querySelectorAll("input[data-memo-id]").forEach((memoInput) => {
    memoInput.addEventListener("change", () => saveEntry(memoInput.dataset.memoId));
  });
}

mainNav.querySelector('[data-screen="today"]').addEventListener("click", renderTodayScreen);
```

Do not remove the existing `mainNav.querySelectorAll("button[data-screen]")` click handler from Task 5 — it is still needed for `stats`/`manage`. Leave that loop in place; this new listener is additive and only re-renders Today's data when its nav button is clicked (the generic loop still handles showing/hiding the screen).

- [ ] **Step 5: Manual verification**

Run `npx serve .`, log in, and:
1. Confirm all 6 default activities appear on first login (check the Firestore console to confirm the `activities` subcollection was seeded).
2. Check one activity's box and type a memo. Reload the page. Confirm both persisted.
3. Change the date picker to yesterday. Confirm it shows an empty log, and that checking a box there does not affect today's entry.

- [ ] **Step 6: Commit**

```bash
git add src/db.js src/app.js sw.js
git commit -m "Add activities/logs data layer and Today screen"
```

---

### Task 7: Stats screen (week/month/year completion rates + streak)

**Files:**
- Modify: `src/app.js` (add Stats-screen rendering)

**Interfaces:**
- Consumes: `getLogsInRange` from `src/db.js` (Task 6), `getRangeDates`/`calcStreak` from `src/date-utils.js` (Task 2), `computePeriodStats`/`getDoneDates` from `src/stats.js` (Task 3).
- Produces: nothing new consumed elsewhere.

- [ ] **Step 1: Read the dataviz skill's guidance before writing the chart markup**

Invoke the `dataviz` skill (or read its bundled reference for palette/bar-chart conventions) so the stats bars use an accessible, consistent color and sizing approach rather than arbitrary values.

- [ ] **Step 2: Extend `src/app.js` — imports**

Update the import block at the top of `src/app.js`:

```js
import { login, logout, onAuthChange } from "./auth.js";
import { seedDefaultActivitiesIfEmpty, getActivities, getLog, setEntry, getLogsInRange } from "./db.js";
import { formatDate, getRangeDates, calcStreak } from "./date-utils.js";
import { computePeriodStats, getDoneDates } from "./stats.js";
```

- [ ] **Step 3: Append the Stats screen logic to `src/app.js`**

```js
document.querySelectorAll(".tabs .tab").forEach((tabButton) => {
  tabButton.addEventListener("click", async () => {
    document.querySelectorAll(".tabs .tab").forEach((b) => b.classList.remove("active"));
    tabButton.classList.add("active");
    await renderStatsScreen(tabButton.dataset.period);
  });
});

async function renderStatsScreen(period) {
  const dates = getRangeDates(period);
  const logs = await getLogsInRange(currentUser.uid, dates[0], dates[dates.length - 1]);
  const activeActivities = activitiesCache.filter((a) => a.active);
  const activeIds = activeActivities.map((a) => a.id);
  const { perActivity, overall } = computePeriodStats(dates, logs, activeIds);

  const allLogs = await getLogsInRange(currentUser.uid, "0000-00-00", formatDate(new Date()));
  const { current, longest } = calcStreak(getDoneDates(allLogs));

  document.getElementById("stats-overall").textContent = `全体の実施率: ${Math.round(overall * 100)}%`;
  document.getElementById("stats-streak").textContent = `現在の継続日数: ${current}日 / 最長: ${longest}日`;

  const chartEl = document.getElementById("stats-chart");
  chartEl.innerHTML = "";
  for (const activity of activeActivities) {
    const stat = perActivity[activity.id] || { rate: 0, done: 0, total: 0 };
    const row = document.createElement("div");
    row.className = "chart-row";
    row.innerHTML = `
      <span class="chart-label">${activity.icon} ${activity.name}</span>
      <div class="chart-bar-track"><div class="chart-bar-fill" style="width:${Math.round(stat.rate * 100)}%; background:${activity.color}"></div></div>
      <span class="chart-value">${stat.done}/${stat.total}</span>
    `;
    chartEl.appendChild(row);
  }
}

mainNav.querySelector('[data-screen="stats"]').addEventListener("click", () => renderStatsScreen("week"));
```

- [ ] **Step 4: Manual verification**

Run `npx serve .`, log in, log a few activities across at least two different days (change the date picker to log a past day), then:
1. Open "振り返り" and confirm the "週" tab shows a non-zero rate for the activities logged and 0% for the ones not logged.
2. Switch to "月" and "年" tabs and confirm the numbers are consistent with (equal to or a superset of) the week's data.
3. Confirm the streak line updates as expected given which consecutive days you logged.

- [ ] **Step 5: Commit**

```bash
git add src/app.js
git commit -m "Add week/month/year stats screen with completion rates and streaks"
```

---

### Task 8: Manage-activities screen

**Files:**
- Modify: `src/app.js` (add Manage-screen rendering)

**Interfaces:**
- Consumes: `addActivity`, `updateActivity`, `reorderActivities`, `getActivities` from `src/db.js` (Task 6).
- Produces: nothing new consumed elsewhere.

- [ ] **Step 1: Extend `src/app.js` — imports**

Update the `db.js` import line to include the remaining functions:

```js
import { seedDefaultActivitiesIfEmpty, getActivities, getLog, setEntry, getLogsInRange, addActivity, updateActivity, reorderActivities } from "./db.js";
```

- [ ] **Step 2: Append the Manage screen logic to `src/app.js`**

```js
function renderManageScreen() {
  const listEl = document.getElementById("manage-activity-list");
  listEl.innerHTML = "";
  activitiesCache.forEach((activity, index) => {
    const item = document.createElement("li");
    item.innerHTML = `
      <span>${activity.icon} ${activity.name}${activity.active ? "" : "（非表示）"}</span>
      <button type="button" data-action="up" data-id="${activity.id}" ${index === 0 ? "disabled" : ""}>↑</button>
      <button type="button" data-action="down" data-id="${activity.id}" ${index === activitiesCache.length - 1 ? "disabled" : ""}>↓</button>
      <button type="button" data-action="toggle" data-id="${activity.id}">${activity.active ? "非表示にする" : "表示に戻す"}</button>
    `;
    listEl.appendChild(item);
  });

  listEl.querySelectorAll("button[data-action]").forEach((button) => {
    button.addEventListener("click", async () => {
      const id = button.dataset.id;
      const index = activitiesCache.findIndex((a) => a.id === id);
      if (button.dataset.action === "toggle") {
        await updateActivity(currentUser.uid, id, { active: !activitiesCache[index].active });
      } else if (button.dataset.action === "up" && index > 0) {
        [activitiesCache[index - 1], activitiesCache[index]] = [activitiesCache[index], activitiesCache[index - 1]];
        await reorderActivities(currentUser.uid, activitiesCache.map((a) => a.id));
      } else if (button.dataset.action === "down" && index < activitiesCache.length - 1) {
        [activitiesCache[index + 1], activitiesCache[index]] = [activitiesCache[index], activitiesCache[index + 1]];
        await reorderActivities(currentUser.uid, activitiesCache.map((a) => a.id));
      }
      activitiesCache = await getActivities(currentUser.uid);
      renderManageScreen();
    });
  });
}

document.getElementById("add-activity-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const nameInput = document.getElementById("add-activity-name");
  const iconInput = document.getElementById("add-activity-icon");
  await addActivity(currentUser.uid, {
    name: nameInput.value,
    icon: iconInput.value || "⭐",
    color: "#3d405b",
    order: activitiesCache.length,
  });
  nameInput.value = "";
  iconInput.value = "";
  activitiesCache = await getActivities(currentUser.uid);
  renderManageScreen();
});

mainNav.querySelector('[data-screen="manage"]').addEventListener("click", renderManageScreen);
```

- [ ] **Step 3: Manual verification**

Run `npx serve .`, log in, open "項目管理", and:
1. Add a new activity with a name and emoji. Confirm it appears in the list and (after switching to "今日") in the Today screen.
2. Move an item up/down. Confirm the order persists after reloading the page.
3. Archive (非表示にする) an item. Confirm it disappears from the Today screen but still shows (as 非表示) in Manage, and can be restored.

- [ ] **Step 4: Commit**

```bash
git add src/app.js
git commit -m "Add activity management screen (add/reorder/archive)"
```

---

### Task 9: Deploy — Firestore rules, GitHub Pages, iPhone install, end-to-end check

**Files:**
- None (deployment/configuration task; `firestore.rules` content was already created in Task 1).

- [ ] **Step 1: Deploy the Firestore security rules**

In the Firebase console, go to Firestore Database → Rules, paste the contents of `firestore.rules` (from Task 1), and click "公開/Publish".

- [ ] **Step 2: Create the GitHub repository**

On github.com, create a new empty repository (no README/license, to avoid merge conflicts with the existing local commits) — e.g. named `brain-training-tracker`. Note the remote URL it gives you.

- [ ] **Step 3: Push the local repository**

```bash
git remote add origin <the URL from Step 2>
git branch -M main
git push -u origin main
```

If this prompts for credentials and the push cannot complete non-interactively, the user completes the push themselves (via a browser-based git credential prompt, GitHub Desktop, or a Personal Access Token).

- [ ] **Step 4: Enable GitHub Pages**

In the repository on github.com: Settings → Pages → Source: "Deploy from a branch" → Branch: `main`, folder `/ (root)` → Save. Wait a minute or two, then note the published URL (`https://<username>.github.io/<repo-name>/`).

- [ ] **Step 5: Authorize the domain in Firebase**

In the Firebase console: Authentication → Settings → Authorized domains → Add domain → enter the GitHub Pages domain (`<username>.github.io`). Without this step, login will fail on the live site with an `auth/unauthorized-domain` error.

- [ ] **Step 6: End-to-end verification on the live site**

1. Open the GitHub Pages URL in a desktop browser. Log in, log an activity, check the stats screen. Confirm no console errors.
2. On the iPhone, open the same URL in Safari, log in, and confirm the app behaves the same as in Task 5–8's manual tests.
3. On the iPhone, tap the Share button → "ホーム画面に追加" → "追加". Confirm an icon appears on the home screen.
4. Tap the new home-screen icon. Confirm the app opens without Safari's address bar (standalone mode) and that it is already logged in.
5. Turn on Airplane Mode and reopen the app from the home-screen icon. Confirm the app shell still loads (service worker cache) even though live Firestore reads will fail until connectivity returns.

- [ ] **Step 7: Commit anything left uncommitted**

```bash
git status
```

If anything is unstaged (e.g. this task added no files, so this should be clean — only run `git add`/`git commit` if `git status` shows changes).
