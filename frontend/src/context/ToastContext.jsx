import { createContext, useContext, useState, useCallback } from "react";
import Toast from "../components/Toast";

const ToastCtx = createContext(null);

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const showToast = useCallback((message, type = "success") => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 3000);
  }, []);

  return (
    <ToastCtx.Provider value={showToast}>
      {children}
      <Toast toasts={toasts} />
    </ToastCtx.Provider>
  );
}

export const useToast = () => useContext(ToastCtx);
