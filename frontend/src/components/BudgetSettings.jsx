import { useEffect, useState } from "react";
import { getBudgets, setBudget } from "../services/api";
import styles from "./BudgetSettings.module.css";

const EXPENSE_CATEGORIES = [
  "food",
  "rent",
  "transport",
  "health",
  "entertainment",
  "shopping",
  "utilities",
  "other",
];

function formatCurrency(amount) {
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
  }).format(amount);
}

function BudgetSettings() {
  const [budgets, setBudgetsState] = useState({});
  const [formState, setFormState] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(null);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    try {
      setLoading(true);
      const data = await getBudgets();
      const map = {};
      (data.budgets || []).forEach((b) => {
        map[b.category] = b;
      });
      setBudgetsState(map);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  function getField(category, field) {
    if (formState[category]?.[field] !== undefined)
      return formState[category][field];
    if (budgets[category]?.[field] !== undefined)
      return String(budgets[category][field]);
    return field === "alertThreshold" ? "0.8" : "";
  }

  function handleChange(category, field, value) {
    setFormState((prev) => ({
      ...prev,
      [category]: { ...prev[category], [field]: value },
    }));
  }

  async function handleSave(category) {
    const monthlyLimit = parseFloat(getField(category, "monthlyLimit"));
    const alertThreshold = parseFloat(getField(category, "alertThreshold"));

    if (!monthlyLimit || monthlyLimit <= 0) return;
    if (isNaN(alertThreshold) || alertThreshold <= 0 || alertThreshold > 1)
      return;

    try {
      setSaving(category);
      await setBudget({ category, monthlyLimit, alertThreshold });
      await load();
      setFormState((prev) => {
        const next = { ...prev };
        delete next[category];
        return next;
      });
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(null);
    }
  }

  if (loading) return <p>Loading…</p>;

  return (
    <div className={styles.container}>
      <h2>Budget Settings</h2>
      <p className={styles.hint}>
        Set a monthly spending limit per category. An alert email is sent when
        spending reaches the alert threshold.
      </p>

      <div className={styles.grid}>
        {EXPENSE_CATEGORIES.map((category) => (
          <div key={category} className={styles.card}>
            <h3 className={styles.catName}>{category}</h3>
            {budgets[category] && (
              <p className={styles.current}>
                {formatCurrency(budgets[category].monthlyLimit)} limit ·{" "}
                {(budgets[category].alertThreshold * 100).toFixed(0)}% alert
              </p>
            )}
            <label className={styles.fieldLabel}>
              Monthly limit (€)
              <input
                type="number"
                value={getField(category, "monthlyLimit")}
                onChange={(e) =>
                  handleChange(category, "monthlyLimit", e.target.value)
                }
                min="1"
                step="1"
                placeholder="e.g. 400"
              />
            </label>
            <label className={styles.fieldLabel}>
              Alert threshold (0.1 – 1.0)
              <input
                type="number"
                value={getField(category, "alertThreshold")}
                onChange={(e) =>
                  handleChange(category, "alertThreshold", e.target.value)
                }
                min="0.1"
                max="1"
                step="0.05"
              />
            </label>
            <button
              className={styles.saveBtn}
              onClick={() => handleSave(category)}
              disabled={saving === category}
            >
              {saving === category ? "Saving…" : "Save"}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

export default BudgetSettings;
