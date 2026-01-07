"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from "react";

const ToastCtx = createContext(null);

function uid() {
  try {
    return crypto?.randomUUID ? crypto.randomUUID() : String(Date.now() + Math.random());
  } catch {
    return String(Date.now() + Math.random());
  }
}

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const timersRef = useRef(new Map()); // id -> timeoutId

  const remove = useCallback((id) => {
    const t = timersRef.current.get(id);
    if (t) window.clearTimeout(t);
    timersRef.current.delete(id);
    setToasts((prev) => prev.filter((x) => x.id !== id));
  }, []);

  const push = useCallback(
    (t) => {
      const id = uid();
      const toast = {
        id,
        tone: t?.tone || "success", // success | warning | error
        title: t?.title || "",
        message: t?.message || "",
        ttl: typeof t?.ttl === "number" ? t.ttl : 2600,
      };

      setToasts((prev) => [toast, ...prev].slice(0, 3));

      const timeoutId = window.setTimeout(() => remove(id), toast.ttl);
      timersRef.current.set(id, timeoutId);

      return id;
    },
    [remove]
  );

  const api = useMemo(() => ({ push, remove }), [push, remove]);

  return (
    <ToastCtx.Provider value={api}>
      {children}

      <div
        className="jp-toast-host"
        aria-live="polite"
        aria-relevant="additions removals"
        role="region"
        aria-label="Notifications"
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`jp-toast jp-toast--${t.tone}`}
            role="status"
            tabIndex={0}
            onMouseEnter={() => {
              const timer = timersRef.current.get(t.id);
              if (timer) window.clearTimeout(timer);
            }}
            onMouseLeave={() => {
              // resume with a shorter TTL so it doesn't hang forever
              if (!timersRef.current.get(t.id)) {
                const timeoutId = window.setTimeout(() => remove(t.id), 1600);
                timersRef.current.set(t.id, timeoutId);
              }
            }}
          >
            <div className="jp-toast__body">
              <div className="jp-toast__title">{t.title}</div>
              {t.message ? <div className="jp-toast__msg">{t.message}</div> : null}
            </div>

            <button
              type="button"
              className="jp-toast__x"
              aria-label="Dismiss"
              onClick={() => remove(t.id)}
            >
              ×
            </button>
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastCtx);
  if (!ctx) throw new Error("useToast must be used inside <ToastProvider>");
  return ctx;
}
