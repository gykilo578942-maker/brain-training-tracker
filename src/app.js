import { login, logout, onAuthChange } from "./auth.js";
import { seedDefaultActivitiesIfEmpty, getActivities, getLog, setEntry } from "./db.js";
import { formatDate } from "./date-utils.js";

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
