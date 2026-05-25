import { useEffect, useState } from "react";
import { ToastProvider } from "./context/ToastContext";
import Dashboard from "./components/Dashboard";
import ExpenseForm from "./components/ExpenseForm";
import IncomeForm from "./components/IncomeForm";
import SavingsGoals from "./components/SavingsGoals";
import BudgetSettings from "./components/BudgetSettings";
import { isApiConfigured } from "./services/api";
import styles from "./App.module.css";

const TABS = [
  { id: "dashboard", label: "📊 Dashboard" },
  { id: "expenses", label: "🧾 Expenses" },
  { id: "income", label: "💰 Income" },
  { id: "savings", label: "🏦 Savings" },
  { id: "budget", label: "⚙️ Budget" },
];

function App() {
  const [activeTab, setActiveTab] = useState("dashboard");
  const [dark, setDark] = useState(() => localStorage.getItem("dark") === "1");

  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
    localStorage.setItem("dark", dark ? "1" : "0");
  }, [dark]);

  const renderTab = () => {
    switch (activeTab) {
      case "dashboard": return <Dashboard />;
      case "expenses": return <ExpenseForm />;
      case "income": return <IncomeForm />;
      case "savings": return <SavingsGoals />;
      case "budget": return <BudgetSettings />;
      default: return <Dashboard />;
    }
  };

  return (
    <ToastProvider>
      <div className={styles.app}>
        <header className={styles.header}>
          <h1>Finance Tracker</h1>
          <button className={styles.darkToggle} onClick={() => setDark((d) => !d)}>
            {dark ? "☀️ Light" : "🌙 Dark"}
          </button>
        </header>
        <nav className={styles.nav}>
          <div className={styles.tabs}>
            {TABS.map((tab) => (
              <button
                key={tab.id}
                className={activeTab === tab.id ? styles.tabActive : styles.tab}
                onClick={() => setActiveTab(tab.id)}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </nav>
        {!isApiConfigured() && (
          <div className={styles.apiWarning}>
            VITE_API_URL is not set — API calls will fail. Rebuild the frontend with your API Gateway URL.
          </div>
        )}
        <main className={styles.main}>{renderTab()}</main>
      </div>
    </ToastProvider>
  );
}

export default App;
