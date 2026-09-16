let resolver = null;
let listeners = new Set();
let current = null;

function notify() {
  listeners.forEach((fn) => fn(current));
}

export function subscribeConfirm(fn) {
  listeners.add(fn);
  fn(current);
  return () => listeners.delete(fn);
}

export function confirmAction({
  title = "Are you sure?",
  message = "",
  confirmLabel = "Delete",
  danger = true,
  noteRequired = false,
  noteLabel = "Notes",
} = {}) {
  return new Promise((resolve) => {
    if (resolver) {
      resolver(current?.noteRequired ? { ok: false, note: "" } : false);
    }
    resolver = resolve;
    current = { title, message, confirmLabel, danger, noteRequired, noteLabel };
    notify();
  });
}

export function settleConfirm(result, note) {
  const done = resolver;
  const snapshot = current;
  resolver = null;
  current = null;
  notify();
  if (!done) return;
  if (snapshot?.noteRequired) {
    done(result ? { ok: true, note: String(note || "").trim() } : { ok: false, note: "" });
  } else {
    done(Boolean(result));
  }
}
