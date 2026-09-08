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
} = {}) {
  return new Promise((resolve) => {
    if (resolver) {
      resolver(false);
    }
    resolver = resolve;
    current = { title, message, confirmLabel, danger };
    notify();
  });
}

export function settleConfirm(result) {
  const done = resolver;
  resolver = null;
  current = null;
  notify();
  if (done) done(Boolean(result));
}
