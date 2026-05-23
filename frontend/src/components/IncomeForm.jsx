import { useEffect, useState } from "react";
import { getIncome, addIncome, deleteIncome } from "../services/api";
import styles from "./IncomeForm.module.css";

const CATEGORIES = ["salary", "freelance", "investment", "gift", "other"];

const today = () => new Date().toISOString().slice(0, 10);
const INITIAL_FORM = { amount: "", category: "salary", description: "", date: today() };

function formatCurrency(amount) {
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
  }).format(amount);
}

function IncomeForm() {
  const [income, setIncome] = useState([]);
  const [form, setForm] = useState(INITIAL_FORM);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    try {
      setLoading(true);
      const data = await getIncome();
      setIncome(data.income || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    try {
      setSubmitting(true);
      await addIncome({ ...form, amount: parseFloat(form.amount) });
      setForm({ ...INITIAL_FORM, date: today() });
      await load();
    } catch (err) {
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(id) {
    try {
      await deleteIncome(id);
      await load();
    } catch (err) {
      console.error(err);
    }
  }

  const total = income.reduce((sum, i) => sum + parseFloat(i.amount ?? 0), 0);
  const sorted = [...income].sort((a, b) => b.date.localeCompare(a.date));

  return (
    <div className={styles.container}>
      <h2>Income</h2>

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
          onChange={(e) =>
            setForm((f) => ({ ...f, description: e.target.value }))
          }
        />
        <input
          type="date"
          value={form.date}
          onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
          required
        />
        <button type="submit" disabled={submitting}>
          {submitting ? "Adding…" : "Add Income"}
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
                  No income records yet.
                </td>
              </tr>
            ) : (
              sorted.map((item) => (
                <tr key={item.transactionId}>
                  <td>{item.date}</td>
                  <td>
                    <span className={styles.badge}>{item.category}</span>
                  </td>
                  <td>{item.description}</td>
                  <td className={styles.amountCell}>
                    {formatCurrency(item.amount)}
                  </td>
                  <td>
                    <button
                      className={styles.deleteBtn}
                      onClick={() => handleDelete(item.transactionId)}
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

export default IncomeForm;
