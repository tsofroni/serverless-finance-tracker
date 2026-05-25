import { useEffect, useState } from "react";
import { getIncome, addIncome, editIncome, deleteIncome } from "../services/api";
import { useToast } from "../context/ToastContext";
import { INCOME_ICONS, INCOME_CATEGORIES } from "../constants/categories";
import styles from "./IncomeForm.module.css";

const today = () => new Date().toISOString().slice(0, 10);
const INITIAL_FORM = { amount: "", category: "salary", description: "", date: today(), recurring: false };

function formatCurrency(amount) {
  return new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(amount);
}

function IncomeForm() {
  const showToast = useToast();
  const [income, setIncome] = useState([]);
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
      recurring: item.recurring || false,
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
        showToast("Income updated!");
        setEditingId(null);
      } else {
        await addIncome(payload);
        showToast("Income added!");
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
      showToast("Income deleted!");
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
    filtered.forEach((i) => {
      rows.push([i.date, i.category, i.description || "", i.amount, i.recurring ? "Yes" : "No"]);
    });
    const csv = rows.map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `income-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const total = income.reduce((sum, i) => sum + parseFloat(i.amount ?? 0), 0);

  const filtered = income
    .filter((i) => {
      if (!search) return true;
      const q = search.toLowerCase();
      return i.description?.toLowerCase().includes(q) || i.category.toLowerCase().includes(q);
    })
    .sort((a, b) => {
      const dir = sort.dir === "asc" ? 1 : -1;
      if (sort.field === "amount") return (parseFloat(a.amount) - parseFloat(b.amount)) * dir;
      if (sort.field === "category") return a.category.localeCompare(b.category) * dir;
      return a.date.localeCompare(b.date) * dir;
    });

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
          {INCOME_CATEGORIES.map((cat) => (
            <option key={cat} value={cat}>
              {INCOME_ICONS[cat]} {cat}
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
          {submitting ? "Saving…" : editingId ? "Update" : "Add Income"}
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
          {filtered.length < income.length && (
            <span className={styles.filterNote}> · {filtered.length} of {income.length} shown</span>
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
                  {search ? "No matching income records." : "No income records yet."}
                </td>
              </tr>
            ) : (
              filtered.map((item) => (
                <tr
                  key={item.transactionId}
                  className={editingId === item.transactionId ? styles.editingRow : ""}
                >
                  <td>{item.date}</td>
                  <td>
                    <span className={styles.badge}>
                      {INCOME_ICONS[item.category] || "💰"} {item.category}
                    </span>
                  </td>
                  <td>
                    {item.description}
                    {item.recurring && (
                      <span className={styles.recurringBadge} title="Recurring">🔁</span>
                    )}
                  </td>
                  <td className={styles.amountCell}>{formatCurrency(item.amount)}</td>
                  <td className={styles.actions}>
                    <button className={styles.editBtn} onClick={() => startEdit(item)}>Edit</button>
                    <button className={styles.deleteBtn} onClick={() => handleDelete(item.transactionId)}>Delete</button>
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
