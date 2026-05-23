import { useEffect, useState } from "react";
import { getSummary } from "../services/api";
import styles from "./MonthlySummary.module.css";

function formatCurrency(amount) {
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
  }).format(amount);
}

function MonthlySummary() {
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        const data = await getSummary(month);
        setSummary(data);
      } catch {
        setSummary(null);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [month]);

  const maxAmount =
    summary?.expensesByCategory?.reduce(
      (max, cat) => Math.max(max, cat.amount),
      1
    ) ?? 1;

  return (
    <div className={styles.container}>
      <h2>Monthly Summary</h2>

      <div className={styles.picker}>
        <label>
          Month
          <input
            type="month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
          />
        </label>
      </div>

      {loading ? (
        <p>Loading…</p>
      ) : summary ? (
        <>
          <div className={styles.cards}>
            <div className={styles.card}>
              <span className={styles.label}>Income</span>
              <span className={`${styles.amount} ${styles.income}`}>
                {formatCurrency(summary.totalIncome)}
              </span>
            </div>
            <div className={styles.card}>
              <span className={styles.label}>Expenses</span>
              <span className={`${styles.amount} ${styles.expense}`}>
                {formatCurrency(summary.totalExpenses)}
              </span>
            </div>
            <div
              className={`${styles.card} ${
                summary.balance >= 0 ? styles.positive : styles.negative
              }`}
            >
              <span className={styles.label}>Balance</span>
              <span className={styles.amount}>
                {formatCurrency(summary.balance)}
              </span>
            </div>
          </div>

          {summary.expensesByCategory?.length > 0 ? (
            <section className={styles.breakdown}>
              <h3>Expenses by Category</h3>
              {summary.expensesByCategory.map((cat) => (
                <div key={cat.category} className={styles.barRow}>
                  <span className={styles.barLabel}>{cat.category}</span>
                  <div className={styles.barTrack}>
                    <div
                      className={styles.barFill}
                      style={{
                        width: `${(cat.amount / maxAmount) * 100}%`,
                      }}
                    />
                  </div>
                  <span className={styles.barValue}>
                    {formatCurrency(cat.amount)}{" "}
                    <span className={styles.pct}>({cat.percentage}%)</span>
                  </span>
                </div>
              ))}
            </section>
          ) : (
            <p className={styles.empty}>No expenses recorded for this month.</p>
          )}
        </>
      ) : (
        <p className={styles.empty}>No data for this month.</p>
      )}
    </div>
  );
}

export default MonthlySummary;
