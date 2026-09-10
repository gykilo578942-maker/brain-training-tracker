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
