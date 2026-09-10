import { login, logout, onAuthChange } from "./auth.js";
import { seedDefaultActivitiesIfEmpty, getActivities, getLog, setEntry, getLogsInRange, addActivity, updateActivity, reorderActivities } from "./db.js";
import { formatDate, getRangeDates, calcStreak } from "./date-utils.js";
import { computePeriodStats, getDoneDates } from "./stats.js";

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

    const label = document.createElement("label");
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.dataset.activityId = activity.id;
    checkbox.checked = entry.done;
    label.appendChild(checkbox);
    label.appendChild(document.createTextNode(` ${activity.icon} ${activity.name}`));

    const memoInput = document.createElement("input");
    memoInput.type = "text";
    memoInput.dataset.memoId = activity.id;
    memoInput.placeholder = "一言メモ";
    memoInput.value = entry.memo;

    item.appendChild(label);
    item.appendChild(memoInput);
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

    const label = document.createElement("span");
    label.className = "chart-label";
    label.textContent = `${activity.icon} ${activity.name}`;

    const track = document.createElement("div");
    track.className = "chart-bar-track";
    const fill = document.createElement("div");
    fill.className = "chart-bar-fill";
    fill.style.width = `${Math.round(stat.rate * 100)}%`;
    fill.style.background = activity.color;
    track.appendChild(fill);

    const value = document.createElement("span");
    value.className = "chart-value";
    value.textContent = `${stat.done}/${stat.total}`;

    row.appendChild(label);
    row.appendChild(track);
    row.appendChild(value);
    chartEl.appendChild(row);
  }
}

mainNav.querySelector('[data-screen="stats"]').addEventListener("click", () => renderStatsScreen("week"));

function renderManageScreen() {
  const listEl = document.getElementById("manage-activity-list");
  listEl.innerHTML = "";
  activitiesCache.forEach((activity, index) => {
    const item = document.createElement("li");

    const label = document.createElement("span");
    label.textContent = `${activity.icon} ${activity.name}${activity.active ? "" : "（非表示）"}`;
    item.appendChild(label);

    const upButton = document.createElement("button");
    upButton.type = "button";
    upButton.dataset.action = "up";
    upButton.dataset.id = activity.id;
    upButton.disabled = index === 0;
    upButton.textContent = "↑";
    item.appendChild(upButton);

    const downButton = document.createElement("button");
    downButton.type = "button";
    downButton.dataset.action = "down";
    downButton.dataset.id = activity.id;
    downButton.disabled = index === activitiesCache.length - 1;
    downButton.textContent = "↓";
    item.appendChild(downButton);

    const toggleButton = document.createElement("button");
    toggleButton.type = "button";
    toggleButton.dataset.action = "toggle";
    toggleButton.dataset.id = activity.id;
    toggleButton.textContent = activity.active ? "非表示にする" : "表示に戻す";
    item.appendChild(toggleButton);

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
