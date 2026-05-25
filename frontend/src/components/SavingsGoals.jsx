import { useEffect, useState } from "react";
import {
  getSavings,
  addSavingGoal,
  updateSavingGoal,
  deleteSavingGoal,
} from "../services/api";
import styles from "./SavingsGoals.module.css";

const INITIAL_FORM = { name: "", targetAmount: "", deadline: "" };

function formatCurrency(amount) {
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
  }).format(amount);
}

function SavingsGoals() {
  const [goals, setGoals] = useState([]);
  const [form, setForm] = useState(INITIAL_FORM);
  const [depositAmounts, setDepositAmounts] = useState({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [depositing, setDepositing] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    try {
      setLoading(true);
      const data = await getSavings();
      setGoals(data.goals || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    try {
      setSubmitting(true);
      await addSavingGoal({
        ...form,
        targetAmount: parseFloat(form.targetAmount),
      });
      setForm(INITIAL_FORM);
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDeposit(goalId) {
    const amount = parseFloat(depositAmounts[goalId] || "0");
    if (!amount || amount <= 0) return;
    setError(null);
    try {
      setDepositing(goalId);
      await updateSavingGoal(goalId, amount);
      setDepositAmounts((prev) => ({ ...prev, [goalId]: "" }));
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setDepositing(null);
    }
  }

  async function handleDelete(goalId) {
    setError(null);
    try {
      await deleteSavingGoal(goalId);
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className={styles.container}>
      <h2>Savings Goals</h2>

      {error && <div className={styles.error}>{error}</div>}

      <form className={styles.form} onSubmit={handleSubmit}>
        <input
          type="text"
          placeholder="Goal name"
          value={form.name}
          onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          required
        />
        <input
          type="number"
          placeholder="Target amount (€)"
          value={form.targetAmount}
          onChange={(e) =>
            setForm((f) => ({ ...f, targetAmount: e.target.value }))
          }
          required
          min="1"
          step="0.01"
        />
        <input
          type="date"
          value={form.deadline}
          onChange={(e) => setForm((f) => ({ ...f, deadline: e.target.value }))}
          required
        />
        <button type="submit" disabled={submitting}>
          {submitting ? "Creating…" : "Create Goal"}
        </button>
      </form>

      {loading ? (
        <p>Loading…</p>
      ) : goals.length === 0 ? (
        <p className={styles.empty}>No savings goals yet.</p>
      ) : (
        <div className={styles.goalsList}>
          {goals.map((goal) => {
            const progress =
              goal.targetAmount > 0
                ? Math.min(
                    (goal.currentAmount / goal.targetAmount) * 100,
                    100
                  )
                : 0;
            const done = progress >= 100;
            return (
              <div key={goal.goalId} className={styles.goalCard}>
                <div className={styles.goalHeader}>
                  <h3>
                    {goal.name}
                    {done && (
                      <span className={styles.doneBadge}>Completed</span>
                    )}
                  </h3>
                  <span className={styles.deadline}>by {goal.deadline}</span>
                </div>
                <div className={styles.amounts}>
                  <span>{formatCurrency(goal.currentAmount)}</span>
                  <span className={styles.separator}>/</span>
                  <span>{formatCurrency(goal.targetAmount)}</span>
                  <span className={styles.pct}>({progress.toFixed(1)}%)</span>
                </div>
                <div className={styles.progressTrack}>
                  <div
                    className={`${styles.progressFill} ${done ? styles.done : ""}`}
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <div className={styles.actions}>
                  <input
                    type="number"
                    placeholder="Deposit (€)"
                    value={depositAmounts[goal.goalId] || ""}
                    onChange={(e) =>
                      setDepositAmounts((prev) => ({
                        ...prev,
                        [goal.goalId]: e.target.value,
                      }))
                    }
                    min="0.01"
                    step="0.01"
                    className={styles.depositInput}
                  />
                  <button
                    className={styles.depositBtn}
                    onClick={() => handleDeposit(goal.goalId)}
                    disabled={depositing === goal.goalId}
                  >
                    {depositing === goal.goalId ? "…" : "Deposit"}
                  </button>
                  <button
                    className={styles.deleteBtn}
                    onClick={() => handleDelete(goal.goalId)}
                  >
                    Delete
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default SavingsGoals;
