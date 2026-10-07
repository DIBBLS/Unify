// Global error toasts: any failure anywhere surfaces as a dismissible
// toast over the content — nobody scrolls up or down hunting for an
// inline error again. Routes call toastError(message) next to (or instead
// of) their local setError; <Toasts/> lives once in the layout.
type Toast = { id: number; message: string };

let nextId = 1;
let listeners: ((t: Toast[]) => void)[] = [];
let items: Toast[] = [];

function emit() {
  const snap = [...items];
  for (const l of listeners) {
    try {
      l(snap);
    } catch {
      // one deaf listener must not break the rest
    }
  }
}

export function toastError(message: string): void {
  const text = (message || 'Something went wrong.').slice(0, 220);
  items = [...items.slice(-2), { id: nextId++, message: text }];
  emit();
  const id = nextId - 1;
  window.setTimeout(() => {
    items = items.filter((t) => t.id !== id);
    emit();
  }, 6000);
}

export function subscribeToasts(fn: (t: Toast[]) => void): () => void {
  listeners = [...listeners, fn];
  fn([...items]);
  return () => {
    listeners = listeners.filter((l) => l !== fn);
  };
}
