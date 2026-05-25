import { useEffect, useState } from "react";
import { getSummary, getSavings } from "../services/api";
import { EXPENSE_ICONS } from "../constants/categories";
import styles from "./Dashboard.module.css";

function formatCurrency(amount) {
  return new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(amount);
}

function monthLabel(yyyyMM) {
  return new Date(yyyyMM + "-01").toLocaleString("default", { month: "short" });
}

function getLast6Months() {
  return Array.from({ length: 6 }, (_, i) => {
    const d = new Date();
    d.setDate(1);
    d.setMonth(d.getMonth() - (5 - i));
    return d.toISOString().slice(0, 7);
  });
}

function Sparkline({ data }) {
  const expenses = data.map((d) => d.totalExpenses ?? 0);
  const maxVal = Math.max(...expenses, 1);
  const barW = 32;
  const gap = 10;
  const labelH = 18;
  const chartH = 64;
  const h = chartH + labelH;
  const svgW = data.length * (barW + gap) - gap;

  return (
    <svg
      viewBox={`0 0 ${svgW} ${h}`}
      width="100%"
      height={h}
      className={styles.sparkline}
      aria-label="Monthly expense trend"
    >
      {data.map((d, i) => {
        const barH = Math.max(3, (expenses[i] / maxVal) * chartH);
        const x = i * (barW + gap);
        const y = chartH - barH;
        const isCurrent = i === data.length - 1;
        return (
          <g key={d.month}>
            <title>
              {d.month}: {formatCurrency(expenses[i])}
            </title>
            <rect
              x={x}
              y={y}
              width={barW}
              height={barH}
              rx="3"
              fill={isCurrent ? "#3498db" : "#b8d4ee"}
              opacity={isCurrent ? 1 : 0.7}
            />
            <text
              x={x + barW / 2}
              y={h - 2}
              textAnchor="middle"
              fontSize="9"
              fill="var(--text-muted)"
            >
              {monthLabel(d.month)}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

function Delta({ current, previous, invert = false }) {
  if (previous == null || current == null) return null;
  const diff = current - previous;
  if (Math.abs(diff) < 0.01) return null;
  const isUp = diff > 0;
  const isGood = invert ? !isUp : isUp;
  return (
    <span className={isGood ? styles.deltaUp : styles.deltaDown}>
      {isUp ? "↑" : "↓"} {formatCurrency(Math.abs(diff))} vs prev
    </span>
  );
}

function Dashboard() {
  const [monthData, setMonthData] = useState([]);
  const [goals, setGoals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const months = getLast6Months();
  const currentMonth = months[months.length - 1];

  useEffect(() => {
    async function load() {
      try {
        const [summaries, goalsData] = await Promise.all([
          Promise.all(months.map((m) => getSummary(m).catch(() => ({ totalIncome: 0, totalExpenses: 0, balance: 0, expensesByCategory: [] })))),
          getSavings(),
        ]);
        setMonthData(months.map((m, i) => ({ month: m, ...summaries[i] })));
        setGoals(goalsData.goals || []);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (loading) return <p className={styles.loading}>Loading dashboard…</p>;
  if (error) return <p className={styles.errorMsg}>Error: {error}</p>;

  const current = monthData[monthData.length - 1];
  const previous = monthData[monthData.length - 2];
  const top3 = current?.expensesByCategory?.slice(0, 3) || [];
  const balance = current?.balance ?? 0;

  return (
    <div className={styles.dashboard}>
      <h2 className={styles.title}>Dashboard — {currentMonth}</h2>

      <div className={styles.cards}>
        <div className={styles.card}>
          <span className={styles.cardLabel}>Income</span>
          <span className={`${styles.cardAmount} ${styles.income}`}>
            {formatCurrency(current?.totalIncome ?? 0)}
          </span>
          <Delta current={current?.totalIncome} previous={previous?.totalIncome} />
        </div>
        <div className={styles.card}>
          <span className={styles.cardLabel}>Expenses</span>
          <span className={`${styles.cardAmount} ${styles.expense}`}>
            {formatCurrency(current?.totalExpenses ?? 0)}
          </span>
          <Delta current={current?.totalExpenses} previous={previous?.totalExpenses} invert />
        </div>
        <div className={`${styles.card} ${balance >= 0 ? styles.positive : styles.negative}`}>
          <span className={styles.cardLabel}>Balance</span>
          <span className={styles.cardAmount}>{formatCurrency(balance)}</span>
          <Delta current={balance} previous={previous ? (previous.balance ?? 0) : null} />
        </div>
      </div>

      <section className={styles.sparklineSection}>
        <h3>6-Month Expense Trend</h3>
        <Sparkline data={monthData} />
      </section>

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
                  <span>🏦 {goal.name}</span>
                  <span>
                    {formatCurrency(goal.currentAmount)} / {formatCurrency(goal.targetAmount)}
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
              <span className={styles.catName}>
                {EXPENSE_ICONS[cat.category] || "📦"} {cat.category}
              </span>
              <span className={styles.catAmount}>{formatCurrency(cat.amount)}</span>
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
