import { useEffect, useState } from "react";
import { getExpenses, addExpense, editExpense, deleteExpense } from "../services/api";
import { useToast } from "../context/ToastContext";
import { EXPENSE_ICONS, EXPENSE_CATEGORIES } from "../constants/categories";
import styles from "./ExpenseForm.module.css";

const today = () => new Date().toISOString().slice(0, 10);
const INITIAL_FORM = { amount: "", category: "food", description: "", date: today(), recurring: false };

function formatCurrency(amount) {
  return new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(amount);
}

function ExpenseForm() {
  const showToast = useToast();
  const [expenses, setExpenses] = useState([]);
  const [form, setForm] = useState(INITIAL_FORM);
  const [editingId, setEditingId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState({ field: "date", dir: "desc" });

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

  function startEdit(expense) {
    setEditingId(expense.transactionId);
    setError(null);
    setForm({
      amount: String(expense.amount),
      category: expense.category,
      description: expense.description || "",
      date: expense.date,
      recurring: expense.recurring || false,
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
        await editExpense(editingId, payload);
        showToast("Expense updated!");
        setEditingId(null);
      } else {
        await addExpense(payload);
        showToast("Expense added!");
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
      await deleteExpense(id);
      if (editingId === id) cancelEdit();
      showToast("Expense deleted!");
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  function toggleSort(field) {
    setSort((s) =>
      s.field === field
        ? { field, dir: s.dir === "asc" ? "desc" : "asc" }
        : { field, dir: "desc" }
    );
  }

  function sortIcon(field) {
    if (sort.field !== field) return " ↕";
    return sort.dir === "asc" ? " ↑" : " ↓";
  }

  function exportCSV() {
    const rows = [["Date", "Category", "Description", "Amount", "Recurring"]];
    filtered.forEach((e) => {
      rows.push([e.date, e.category, e.description || "", e.amount, e.recurring ? "Yes" : "No"]);
    });
    const csv = rows.map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `expenses-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const total = expenses.reduce((sum, e) => sum + parseFloat(e.amount ?? 0), 0);

  const filtered = expenses
    .filter((e) => {
      if (!search) return true;
      const q = search.toLowerCase();
      return e.description?.toLowerCase().includes(q) || e.category.toLowerCase().includes(q);
    })
    .sort((a, b) => {
      const dir = sort.dir === "asc" ? 1 : -1;
      if (sort.field === "amount") return (parseFloat(a.amount) - parseFloat(b.amount)) * dir;
      if (sort.field === "category") return a.category.localeCompare(b.category) * dir;
      return a.date.localeCompare(b.date) * dir;
    });

  return (
    <div className={styles.container}>
      <h2>{editingId ? "Edit Expense" : "Expenses"}</h2>

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
          {EXPENSE_CATEGORIES.map((cat) => (
            <option key={cat} value={cat}>
              {EXPENSE_ICONS[cat]} {cat}
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
        <label className={styles.checkLabel}>
          <input
            type="checkbox"
            checked={form.recurring}
            onChange={(e) => setForm((f) => ({ ...f, recurring: e.target.checked }))}
          />
          Recurring
        </label>
        <button type="submit" disabled={submitting}>
          {submitting ? "Saving…" : editingId ? "Update" : "Add Expense"}
        </button>
        {editingId && (
          <button type="button" className={styles.cancelBtn} onClick={cancelEdit}>
            Cancel
          </button>
        )}
      </form>

      <div className={styles.toolbar}>
        <div className={styles.totalBar}>
          Total: <strong>{formatCurrency(total)}</strong>
          {filtered.length < expenses.length && (
            <span className={styles.filterNote}> · {filtered.length} of {expenses.length} shown</span>
          )}
        </div>
        <div className={styles.toolbarRight}>
          <input
            className={styles.searchInput}
            type="text"
            placeholder="Search…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <button className={styles.csvBtn} onClick={exportCSV} disabled={filtered.length === 0}>
            Export CSV
          </button>
        </div>
      </div>

      {loading ? (
        <p>Loading…</p>
      ) : (
        <table className={styles.table}>
          <thead>
            <tr>
              <th className={styles.sortable} onClick={() => toggleSort("date")}>
                Date{sortIcon("date")}
              </th>
              <th className={styles.sortable} onClick={() => toggleSort("category")}>
                Category{sortIcon("category")}
              </th>
              <th>Description</th>
              <th className={styles.sortable} onClick={() => toggleSort("amount")}>
                Amount{sortIcon("amount")}
              </th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan="5" className={styles.empty}>
                  {search ? "No matching expenses." : "No expenses yet."}
                </td>
              </tr>
            ) : (
              filtered.map((expense) => (
                <tr
                  key={expense.transactionId}
                  className={editingId === expense.transactionId ? styles.editingRow : ""}
                >
                  <td>{expense.date}</td>
                  <td>
                    <span className={styles.badge}>
                      {EXPENSE_ICONS[expense.category] || "📦"} {expense.category}
                    </span>
                  </td>
                  <td>
                    {expense.description}
                    {expense.recurring && (
                      <span className={styles.recurringBadge} title="Recurring">🔁</span>
                    )}
                  </td>
                  <td className={styles.amountCell}>{formatCurrency(expense.amount)}</td>
                  <td className={styles.actions}>
                    <button className={styles.editBtn} onClick={() => startEdit(expense)}>Edit</button>
                    <button className={styles.deleteBtn} onClick={() => handleDelete(expense.transactionId)}>Delete</button>
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
