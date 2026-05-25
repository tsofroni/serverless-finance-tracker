import { useEffect, useState } from "react";
import { getExpenses, addExpense, deleteExpense } from "../services/api";
import styles from "./ExpenseForm.module.css";

const CATEGORIES = [
  "food",
  "rent",
  "transport",
  "health",
  "entertainment",
  "shopping",
  "utilities",
  "other",
];

const today = () => new Date().toISOString().slice(0, 10);
const INITIAL_FORM = { amount: "", category: "food", description: "", date: today() };

function formatCurrency(amount) {
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
  }).format(amount);
}

function ExpenseForm() {
  const [expenses, setExpenses] = useState([]);
  const [form, setForm] = useState(INITIAL_FORM);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    try {
      setLoading(true);
      const data = await getExpenses();
      setExpenses(data.expenses || []);
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
      await addExpense({ ...form, amount: parseFloat(form.amount) });
      setForm({ ...INITIAL_FORM, date: today() });
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(id) {
    setError(null);
    try {
      await deleteExpense(id);
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  const total = expenses.reduce((sum, e) => sum + parseFloat(e.amount ?? 0), 0);
  const sorted = [...expenses].sort((a, b) => b.date.localeCompare(a.date));

  return (
    <div className={styles.container}>
      <h2>Expenses</h2>

      {error && <div className={styles.error}>{error}</div>}

      <form className={styles.form} onSubmit={handleSubmit}>
        <input
          type="number"
          placeholder="Amount (€)"
          value={form.amount}
          onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
          required
          min="0.01"
          step="0.01"
        />
        <select
          value={form.category}
          onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
        >
          {CATEGORIES.map((cat) => (
            <option key={cat} value={cat}>
              {cat}
            </option>
          ))}
        </select>
        <input
          type="text"
          placeholder="Description"
          value={form.description}
          onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
        />
        <input
          type="date"
          value={form.date}
          onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
          required
        />
        <button type="submit" disabled={submitting}>
          {submitting ? "Adding…" : "Add Expense"}
        </button>
      </form>

      <div className={styles.totalBar}>
        Total: <strong>{formatCurrency(total)}</strong>
      </div>

      {loading ? (
        <p>Loading…</p>
      ) : (
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Date</th>
              <th>Category</th>
              <th>Description</th>
              <th>Amount</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {sorted.length === 0 ? (
              <tr>
                <td colSpan="5" className={styles.empty}>
                  No expenses yet.
                </td>
              </tr>
            ) : (
              sorted.map((expense) => (
                <tr key={expense.transactionId}>
                  <td>{expense.date}</td>
                  <td>
                    <span className={styles.badge}>{expense.category}</span>
                  </td>
                  <td>{expense.description}</td>
                  <td className={styles.amountCell}>
                    {formatCurrency(expense.amount)}
                  </td>
                  <td>
                    <button
                      className={styles.deleteBtn}
                      onClick={() => handleDelete(expense.transactionId)}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      )}
    </div>
  );
}

export default ExpenseForm;
