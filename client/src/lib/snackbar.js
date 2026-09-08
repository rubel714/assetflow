let listeners = new Set();
let current = null;
let hideTimer = null;

function notify() {
  listeners.forEach((fn) => fn(current));
}

export function subscribeSnackbar(fn) {
  listeners.add(fn);
  fn(current);
  return () => listeners.delete(fn);
}

export function hideSnackbar() {
  if (hideTimer) {
    clearTimeout(hideTimer);
    hideTimer = null;
  }
  current = null;
  notify();
}

export function showSnackbar(message, { duration = 3000, type = "success" } = {}) {
  if (hideTimer) {
    clearTimeout(hideTimer);
  }
  current = { id: Date.now(), message, type };
  notify();
  hideTimer = setTimeout(() => {
    hideTimer = null;
    current = null;
    notify();
  }, duration);
}
