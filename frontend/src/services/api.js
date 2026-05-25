const BASE_URL = import.meta.env.VITE_API_URL || "";

export const isApiConfigured = () => Boolean(import.meta.env.VITE_API_URL);

async function request(path, options = {}) {
  let response;
  try {
    response = await fetch(`${BASE_URL}${path}`, {
      headers: { "Content-Type": "application/json" },
      ...options,
    });
  } catch (networkErr) {
    throw new Error(`Network error — check your API URL and CORS settings. (${networkErr.message})`);
  }

  let data;
  try {
    data = await response.json();
  } catch {
    throw new Error(
      `Server returned a non-JSON response (HTTP ${response.status}). ` +
      `Check that VITE_API_URL points to your API Gateway invoke URL.`
    );
  }

  if (!response.ok) throw new Error(data.error || `Request failed (HTTP ${response.status})`);
  return data;
}

// All mutating operations use POST with an "action" field.
// This avoids CORS preflight issues with DELETE/PUT on API Gateway sub-resources.

// Expenses
export const getExpenses = () => request("/expenses");
export const addExpense = (data) =>
  request("/expenses", {
    method: "POST",
    body: JSON.stringify({ action: "create", ...data }),
  });
export const editExpense = (id, data) =>
  request("/expenses", {
    method: "POST",
    body: JSON.stringify({ action: "update", transactionId: id, ...data }),
  });
export const deleteExpense = (id) =>
  request("/expenses", {
    method: "POST",
    body: JSON.stringify({ action: "delete", transactionId: id }),
  });

// Income
export const getIncome = () => request("/income");
export const addIncome = (data) =>
  request("/income", {
    method: "POST",
    body: JSON.stringify({ action: "create", ...data }),
  });
export const editIncome = (id, data) =>
  request("/income", {
    method: "POST",
    body: JSON.stringify({ action: "update", transactionId: id, ...data }),
  });
export const deleteIncome = (id) =>
  request("/income", {
    method: "POST",
    body: JSON.stringify({ action: "delete", transactionId: id }),
  });

// Savings goals
export const getSavings = () => request("/savings");
export const addSavingGoal = (data) =>
  request("/savings", {
    method: "POST",
    body: JSON.stringify({ action: "create", ...data }),
  });
export const depositToGoal = (id, amount) =>
  request("/savings", {
    method: "POST",
    body: JSON.stringify({ action: "deposit", goalId: id, amount }),
  });
export const editSavingGoal = (id, data) =>
  request("/savings", {
    method: "POST",
    body: JSON.stringify({ action: "update", goalId: id, ...data }),
  });
export const deleteSavingGoal = (id) =>
  request("/savings", {
    method: "POST",
    body: JSON.stringify({ action: "delete", goalId: id }),
  });

// Budget
export const getBudgets = () => request("/budget");
export const setBudget = (data) =>
  request("/budget", { method: "POST", body: JSON.stringify(data) });

// Summary
export const getSummary = (month) => request(`/summary?month=${month}`);
