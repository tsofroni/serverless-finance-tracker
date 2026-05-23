import { useEffect, useState } from "react";
import { getSummary, getSavings } from "../services/api";
import styles from "./Dashboard.module.css";

function formatCurrency(amount) {
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
  }).format(amount);
}

function Dashboard() {
  const [summary, setSummary] = useState(null);
  const [goals, setGoals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const currentMonth = new Date().toISOString().slice(0, 7);

  useEffect(() => {
    async function load() {
      try {
        const [summaryData, goalsData] = await Promise.all([
          getSummary(currentMonth),
          getSavings(),
        ]);
        setSummary(summaryData);
        setGoals(goalsData.goals || []);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [currentMonth]);

  if (loading) return <p className={styles.loading}>Loading dashboard…</p>;
  if (error) return <p className={styles.errorMsg}>Error: {error}</p>;

  const top3 = summary?.expensesByCategory?.slice(0, 3) || [];
  const balance = summary?.balance ?? 0;

  return (
    <div className={styles.dashboard}>
      <h2 className={styles.title}>Dashboard — {currentMonth}</h2>

      <div className={styles.cards}>
        <div className={styles.card}>
          <span className={styles.cardLabel}>Income</span>
          <span className={`${styles.cardAmount} ${styles.income}`}>
            {formatCurrency(summary?.totalIncome ?? 0)}
          </span>
        </div>
        <div className={styles.card}>
          <span className={styles.cardLabel}>Expenses</span>
          <span className={`${styles.cardAmount} ${styles.expense}`}>
            {formatCurrency(summary?.totalExpenses ?? 0)}
          </span>
        </div>
        <div className={`${styles.card} ${balance >= 0 ? styles.positive : styles.negative}`}>
          <span className={styles.cardLabel}>Balance</span>
          <span className={styles.cardAmount}>{formatCurrency(balance)}</span>
        </div>
      </div>

      {goals.length > 0 && (
        <section className={styles.section}>
          <h3>Savings Goals</h3>
          {goals.map((goal) => {
            const progress =
              goal.targetAmount > 0
                ? Math.min((goal.currentAmount / goal.targetAmount) * 100, 100)
                : 0;
            return (
              <div key={goal.goalId} className={styles.goalItem}>
                <div className={styles.goalHeader}>
                  <span>{goal.name}</span>
                  <span>
                    {formatCurrency(goal.currentAmount)} /{" "}
                    {formatCurrency(goal.targetAmount)}
                  </span>
                </div>
                <div className={styles.progressTrack}>
                  <div
                    className={styles.progressFill}
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>
            );
          })}
        </section>
      )}

      {top3.length > 0 && (
        <section className={styles.section}>
          <h3>Top 3 Expense Categories</h3>
          {top3.map((cat) => (
            <div key={cat.category} className={styles.categoryRow}>
              <span className={styles.catName}>{cat.category}</span>
              <span className={styles.catAmount}>
                {formatCurrency(cat.amount)}
              </span>
              <span className={styles.catPercent}>{cat.percentage}%</span>
            </div>
          ))}
        </section>
      )}

      {top3.length === 0 && goals.length === 0 && (
        <p className={styles.empty}>
          No data yet. Add some expenses and income to see your summary.
        </p>
      )}
    </div>
  );
}

export default Dashboard;
