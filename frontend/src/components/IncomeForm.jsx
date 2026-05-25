import { useEffect, useState } from "react";
import { getIncome, addIncome, editIncome, deleteIncome } from "../services/api";
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
  const [editingId, setEditingId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    try {
      setLoading(true);
      const data = await getIncome();
      setIncome(data.income || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  function startEdit(item) {
    setEditingId(item.transactionId);
    setError(null);
    setForm({
      amount: String(item.amount),
      category: item.category,
      description: item.description || "",
      date: item.date,
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function cancelEdit() {
    setEditingId(null);
    setForm({ ...INITIAL_FORM, date: today() });
    setError(null);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    try {
      setSubmitting(true);
      const payload = { ...form, amount: parseFloat(form.amount) };
      if (editingId) {
        await editIncome(editingId, payload);
        setEditingId(null);
      } else {
        await addIncome(payload);
      }
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
      await deleteIncome(id);
      if (editingId === id) cancelEdit();
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  const total = income.reduce((sum, i) => sum + parseFloat(i.amount ?? 0), 0);
  const sorted = [...income].sort((a, b) => b.date.localeCompare(a.date));

  return (
    <div className={styles.container}>
      <h2>{editingId ? "Edit Income" : "Income"}</h2>

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
          {submitting ? "Saving…" : editingId ? "Update" : "Add Income"}
        </button>
        {editingId && (
          <button type="button" className={styles.cancelBtn} onClick={cancelEdit}>
            Cancel
          </button>
        )}
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
                <tr
                  key={item.transactionId}
                  className={editingId === item.transactionId ? styles.editingRow : ""}
                >
                  <td>{item.date}</td>
                  <td>
                    <span className={styles.badge}>{item.category}</span>
                  </td>
                  <td>{item.description}</td>
                  <td className={styles.amountCell}>
                    {formatCurrency(item.amount)}
                  </td>
                  <td className={styles.actions}>
                    <button
                      className={styles.editBtn}
                      onClick={() => startEdit(item)}
                    >
                      Edit
                    </button>
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
