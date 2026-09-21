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
  costPrompt = false,
  costLabel = "Cost",
} = {}) {
  return new Promise((resolve) => {
    if (resolver) {
      resolver(current?.noteRequired || current?.costPrompt ? { ok: false } : false);
    }
    resolver = resolve;
    current = {
      title,
      message,
      confirmLabel,
      danger,
      noteRequired,
      noteLabel,
      costPrompt,
      costLabel,
    };
    notify();
  });
}

export function settleConfirm(result, extras = {}) {
  const done = resolver;
  const snapshot = current;
  resolver = null;
  current = null;
  notify();
  if (!done) return;
  if (snapshot?.noteRequired) {
    done(result ? { ok: true, note: String(extras.note || "").trim() } : { ok: false, note: "" });
  } else if (snapshot?.costPrompt) {
    done(result ? { ok: true, cost: extras.cost } : { ok: false, cost: "" });
  } else {
    done(Boolean(result));
  }
}
