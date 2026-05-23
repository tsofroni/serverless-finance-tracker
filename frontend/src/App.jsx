import { useState } from "react";
import Dashboard from "./components/Dashboard";
import ExpenseForm from "./components/ExpenseForm";
import IncomeForm from "./components/IncomeForm";
import SavingsGoals from "./components/SavingsGoals";
import BudgetSettings from "./components/BudgetSettings";
import styles from "./App.module.css";

const TABS = [
  { id: "dashboard", label: "Dashboard" },
  { id: "expenses", label: "Expenses" },
  { id: "income", label: "Income" },
  { id: "savings", label: "Savings" },
  { id: "budget", label: "Budget" },
];

function App() {
  const [activeTab, setActiveTab] = useState("dashboard");

  const renderTab = () => {
    switch (activeTab) {
      case "dashboard":
        return <Dashboard />;
      case "expenses":
        return <ExpenseForm />;
      case "income":
        return <IncomeForm />;
      case "savings":
        return <SavingsGoals />;
      case "budget":
        return <BudgetSettings />;
      default:
        return <Dashboard />;
    }
  };

  return (
    <div className={styles.app}>
      <header className={styles.header}>
        <h1>Finance Tracker</h1>
      </header>
      <nav className={styles.nav}>
        {TABS.map((tab) => (
          <button
            key={tab.id}
            className={activeTab === tab.id ? styles.tabActive : styles.tab}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </nav>
      <main className={styles.main}>{renderTab()}</main>
    </div>
  );
}

export default App;
