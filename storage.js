/**
 * storage.js
 * ---------------------------------------------------------
 * localStorage へのデータ読み書きを一元管理するモジュール。
 *
 * 【設計方針】
 * 将来 Google スプレッドシート連携（フェーズ2）に差し替える際、
 * このファイルの各関数の中身だけを GAS API 呼び出しに置き換えれば
 * 他のファイル（app.js, recipe.js 等）は変更不要になるように設計。
 * つまり「データの保存先」を意識するのはこのファイルだけにする。
 * ---------------------------------------------------------
 */

const STORAGE_KEYS = {
  ingredients: "rm_ingredients",
  categories: "rm_categories",
  unitConversions: "rm_unit_conversions",
  purchases: "rm_purchases",
  inventory: "rm_inventory",
  recipes: "rm_recipes",
  shoppingList: "rm_shopping_list",
  cookedHistory: "rm_cooked_history",
  budgets: "rm_budgets",
  // ---- お金管理機能（既存の食費予算 budgets とは別の独立した仕組み） ----
  expenses: "rm_expenses",
  expenseCategories: "rm_expense_categories",
  incomes: "rm_incomes",
  categoryBudgets: "rm_category_budgets",
  nutritionTarget: "rm_nutrition_target",
  initialized: "rm_initialized",
  migratedMoneynote: "rm_migrated_moneynote_v1",
};

const Storage = {
  /**
   * 初回起動時のみ、data.js の初期データを localStorage に書き込む
   */
  initializeData() {
    if (localStorage.getItem(STORAGE_KEYS.initialized)) return;

    localStorage.setItem(STORAGE_KEYS.ingredients, JSON.stringify(INITIAL_INGREDIENTS));
    localStorage.setItem(STORAGE_KEYS.categories, JSON.stringify(INITIAL_CATEGORIES));
    localStorage.setItem(STORAGE_KEYS.unitConversions, JSON.stringify(INITIAL_UNIT_CONVERSIONS));
    localStorage.setItem(STORAGE_KEYS.purchases, JSON.stringify(INITIAL_PURCHASES));
    localStorage.setItem(STORAGE_KEYS.inventory, JSON.stringify(INITIAL_INVENTORY));
    localStorage.setItem(STORAGE_KEYS.recipes, JSON.stringify(INITIAL_RECIPES));
    localStorage.setItem(STORAGE_KEYS.shoppingList, JSON.stringify(INITIAL_SHOPPING_LIST));
    localStorage.setItem(STORAGE_KEYS.cookedHistory, JSON.stringify(INITIAL_COOKED_HISTORY));
    localStorage.setItem(STORAGE_KEYS.budgets, JSON.stringify(INITIAL_BUDGETS));
    localStorage.setItem(STORAGE_KEYS.expenses, JSON.stringify(INITIAL_EXPENSES));
    localStorage.setItem(STORAGE_KEYS.expenseCategories, JSON.stringify(INITIAL_EXPENSE_CATEGORIES));
    localStorage.setItem(STORAGE_KEYS.incomes, JSON.stringify(INITIAL_INCOMES));
    localStorage.setItem(STORAGE_KEYS.categoryBudgets, JSON.stringify(INITIAL_CATEGORY_BUDGETS));
    localStorage.setItem(STORAGE_KEYS.nutritionTarget, JSON.stringify(INITIAL_NUTRITION_TARGET));
    localStorage.setItem(STORAGE_KEYS.initialized, "true");
    // 新規インストールは最初からマネーノート仕様のデータなので移行不要
    localStorage.setItem(STORAGE_KEYS.migratedMoneynote, "true");
  },

  /**
   * 「マネーノート」リニューアルに伴うデータ移行（既存ユーザー向け・初回のみ実行）。
   * ・支出カテゴリ「ジム」→「サブスク」に統合
   * ・支出カテゴリ「外食」→「食費」に統合（本来は購入履歴側で管理するため、
   *   万一残っていた場合の救済措置）
   * ・支出カテゴリ一覧に不足している新カテゴリ（保険・被服費・教育費・投資）を追加
   * ・外食の購入履歴で区分未設定のもの → 「外食（一人）」として扱う
   */
  migrateToMoneynote() {
    if (localStorage.getItem(STORAGE_KEYS.migratedMoneynote)) return;

    // ---- 支出カテゴリ一覧の統合・補完 ----
    const categories = this.getExpenseCategories();
    const hasCategory = (name) => categories.some((c) => c.name === name);
    const filtered = categories.filter((c) => c.name !== "ジム" && c.name !== "外食");
    INITIAL_EXPENSE_CATEGORIES.forEach((c) => {
      if (!filtered.some((x) => x.name === c.name)) filtered.push({ ...c });
    });
    this.setExpenseCategories(filtered);

    // ---- 支出履歴：ジム→サブスク、外食→食費 に付け替え ----
    const expenses = this.getExpenses().map((e) => {
      if (e.category === "ジム") return { ...e, category: "サブスク" };
      if (e.category === "外食") return { ...e, category: "食費", foodType: e.foodType || "お菓子" };
      return e;
    });
    this.setExpenses(expenses);

    // ---- カテゴリ別予算：ジム→サブスク、外食→食費（同月に両方あれば合算） ----
    const budgets = this.getCategoryBudgets();
    const mergedBudgets = [];
    budgets.forEach((b) => {
      const newCategory = b.category === "ジム" ? "サブスク" : (b.category === "外食" ? "食費" : b.category);
      const existing = mergedBudgets.find((x) => x.yearMonth === b.yearMonth && x.category === newCategory);
      if (existing) {
        existing.budget += b.budget;
      } else {
        mergedBudgets.push({ ...b, category: newCategory });
      }
    });
    this.setCategoryBudgets(mergedBudgets);

    // ---- 購入履歴：外食で区分未設定のものは「一人」扱いにする ----
    const purchases = this.getPurchases().map((p) => {
      if (p.type === "eatout" && !p.eatoutType) return { ...p, eatoutType: "solo" };
      return p;
    });
    this.setPurchases(purchases);

    localStorage.setItem(STORAGE_KEYS.migratedMoneynote, "true");
  },

  _get(key) {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : [];
  },

  _set(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  },

  // ---------------- 食材マスター ----------------
  getIngredients() { return this._get(STORAGE_KEYS.ingredients); },
  setIngredients(list) { this._set(STORAGE_KEYS.ingredients, list); },
  findIngredientByName(name) {
    return this.getIngredients().find((i) => i.name === name) || null;
  },

  // ---------------- カテゴリ ----------------
  getCategories() { return this._get(STORAGE_KEYS.categories); },
  setCategories(list) { this._set(STORAGE_KEYS.categories, list); },

  // ---------------- 単位変換 ----------------
  getUnitConversions() { return this._get(STORAGE_KEYS.unitConversions); },
  setUnitConversions(list) { this._set(STORAGE_KEYS.unitConversions, list); },

  // ---------------- 購入履歴 ----------------
  getPurchases() { return this._get(STORAGE_KEYS.purchases); },
  setPurchases(list) {
    this._set(STORAGE_KEYS.purchases, list);
    if (typeof GasSync !== "undefined") GasSync.pushPurchases();
  },
  addPurchase(purchase) {
    const list = this.getPurchases();
    purchase.id = "P" + Date.now() + Math.floor(Math.random() * 1000);
    list.push(purchase);
    this.setPurchases(list);
    return purchase;
  },
  /** 購入履歴を更新する（在庫への反映は呼び出し側の責任） */
  updatePurchase(id, updates) {
    const list = this.getPurchases();
    const idx = list.findIndex((p) => p.id === id);
    if (idx === -1) return null;
    list[idx] = { ...list[idx], ...updates };
    this.setPurchases(list);
    return list[idx];
  },
  /** 購入履歴を削除する（在庫への反映は呼び出し側の責任） */
  deletePurchase(id) {
    this.setPurchases(this.getPurchases().filter((p) => p.id !== id));
  },
  /** 指定食材の直近購入履歴を取得（日付降順で先頭） */
  getLatestPurchase(name) {
    const list = this.getPurchases()
      .filter((p) => p.name === name)
      .sort((a, b) => (a.date < b.date ? 1 : -1));
    return list[0] || null;
  },

  // ---------------- 在庫 ----------------
  getInventory() { return this._get(STORAGE_KEYS.inventory); },
  setInventory(list) {
    this._set(STORAGE_KEYS.inventory, list);
    if (typeof GasSync !== "undefined") GasSync.pushInventory();
  },
  findInventoryItem(name, unit) {
    return this.getInventory().find((i) => i.name === name && i.unit === unit) || null;
  },
  addOrUpdateInventoryOnPurchase(name, quantity, unit) {
    const list = this.getInventory();
    const existing = list.find((i) => i.name === name && i.unit === unit);
    if (existing) {
      existing.quantity = round2(existing.quantity + quantity);
    } else {
      list.push({
        id: "INV" + Date.now() + Math.floor(Math.random() * 1000),
        name, quantity, unit, status: "未開封",
      });
    }
    this.setInventory(list);
  },
  /**
   * 購入履歴の編集・削除に伴い、以前その購入で加算された分の在庫を巻き戻す（減算する）。
   * 対応する在庫が見つからない場合（既に使い切って削除済み・買い物リストへ移動済み等）は何もしない。
   * 減算した結果が負の数量にならないよう 0 で下限を設ける。
   */
  subtractInventoryOnPurchaseUndo(name, quantity, unit) {
    const list = this.getInventory();
    const existing = list.find((i) => i.name === name && i.unit === unit);
    if (!existing) return;
    existing.quantity = Math.max(0, round2(existing.quantity - quantity));
    this.setInventory(list);
  },
  addInventoryItem(item) {
    const list = this.getInventory();
    item.id = "INV" + Date.now() + Math.floor(Math.random() * 1000);
    list.push(item);
    this.setInventory(list);
    return item;
  },
  updateInventoryItem(id, updates) {
    const list = this.getInventory();
    const idx = list.findIndex((i) => i.id === id);
    if (idx === -1) return null;
    list[idx] = { ...list[idx], ...updates };
    this.setInventory(list);
    return list[idx];
  },
  deleteInventoryItem(id) {
    this.setInventory(this.getInventory().filter((i) => i.id !== id));
  },

  // ---------------- レシピ ----------------
  getRecipes() { return this._get(STORAGE_KEYS.recipes); },
  setRecipes(list) {
    this._set(STORAGE_KEYS.recipes, list);
    if (typeof GasSync !== "undefined") GasSync.pushRecipes();
  },
  getRecipeById(id) { return this.getRecipes().find((r) => r.id === id) || null; },
  addRecipe(recipe) {
    const list = this.getRecipes();
    recipe.id = "R" + Date.now() + Math.floor(Math.random() * 1000);
    list.push(recipe);
    this.setRecipes(list);
    return recipe;
  },
  updateRecipe(id, updates) {
    const list = this.getRecipes();
    const idx = list.findIndex((r) => r.id === id);
    if (idx === -1) return null;
    list[idx] = { ...list[idx], ...updates };
    this.setRecipes(list);
    return list[idx];
  },
  deleteRecipe(id) {
    this.setRecipes(this.getRecipes().filter((r) => r.id !== id));
  },

  // ---------------- 買い物リスト ----------------
  getShoppingList() { return this._get(STORAGE_KEYS.shoppingList); },
  setShoppingList(list) {
    this._set(STORAGE_KEYS.shoppingList, list);
    if (typeof GasSync !== "undefined") GasSync.pushShoppingList();
  },
  addShoppingItem(item) {
    const list = this.getShoppingList();
    // 同名・同理由の未購入項目が既にあれば重複追加しない
    const dup = list.find((i) => i.name === item.name && i.status === "未購入");
    if (dup) return dup;
    item.id = "SL" + Date.now() + Math.floor(Math.random() * 1000);
    item.status = "未購入";
    list.push(item);
    this.setShoppingList(list);
    return item;
  },
  removeShoppingItemByName(name) {
    this.setShoppingList(this.getShoppingList().filter((i) => i.name !== name));
  },
  deleteShoppingItem(id) {
    this.setShoppingList(this.getShoppingList().filter((i) => i.id !== id));
  },

  // ---------------- 調理履歴 ----------------
  // entry: { id, date, recipeId(手動追加の場合はnull), name, servings, cost, materials, isManual }
  getCookedHistory() { return this._get(STORAGE_KEYS.cookedHistory); },
  setCookedHistory(list) {
    this._set(STORAGE_KEYS.cookedHistory, list);
    if (typeof GasSync !== "undefined") GasSync.pushCookedHistory();
  },
  getCookedHistoryById(id) {
    return this.getCookedHistory().find((h) => h.id === id) || null;
  },
  addCookedHistory(entry) {
    const list = this.getCookedHistory();
    entry.id = "CH" + Date.now() + Math.floor(Math.random() * 1000);
    list.push(entry);
    this.setCookedHistory(list);
    return entry;
  },
  updateCookedHistory(id, updates) {
    const list = this.getCookedHistory();
    const idx = list.findIndex((h) => h.id === id);
    if (idx === -1) return null;
    list[idx] = { ...list[idx], ...updates };
    this.setCookedHistory(list);
    return list[idx];
  },
  deleteCookedHistory(id) {
    this.setCookedHistory(this.getCookedHistory().filter((h) => h.id !== id));
  },

  // ---------------- 月別食費予算 ----------------
  getBudgets() { return this._get(STORAGE_KEYS.budgets); },
  setBudgets(list) {
    this._set(STORAGE_KEYS.budgets, list);
    if (typeof GasSync !== "undefined") GasSync.pushBudgets();
  },
  /** 指定年月(YYYY-MM)の予算設定を取得。未設定なら null */
  getBudgetForMonth(yearMonth) {
    return this.getBudgets().find((b) => b.yearMonth === yearMonth) || null;
  },
  /** 指定年月の予算を設定（既存なら上書き、無ければ追加） */
  setBudgetForMonth(yearMonth, amount) {
    const list = this.getBudgets();
    const idx = list.findIndex((b) => b.yearMonth === yearMonth);
    if (idx === -1) {
      list.push({ yearMonth, budget: amount });
    } else {
      list[idx].budget = amount;
    }
    this.setBudgets(list);
  },

  // =========================================================
  // お金管理機能（家計簿）
  // ---------------------------------------------------------
  // 既存の「食費管理（購入履歴）」「食費予算（budgets）」とは
  // 完全に独立した仕組み。「食費」「外食」の実額は購入履歴から
  // 都度計算するため、支出履歴（expenses）には保存しない。
  // =========================================================

  // ---------------- 支出履歴（食費・外食を除く手入力の支出） ----------------
  getExpenses() { return this._get(STORAGE_KEYS.expenses); },
  setExpenses(list) {
    this._set(STORAGE_KEYS.expenses, list);
    if (typeof GasSync !== "undefined") GasSync.pushExpenses();
  },
  addExpense(item) {
    const list = this.getExpenses();
    item.id = "EX" + Date.now() + Math.floor(Math.random() * 1000);
    list.push(item);
    this.setExpenses(list);
    return item;
  },
  updateExpense(id, updates) {
    const list = this.getExpenses();
    const idx = list.findIndex((e) => e.id === id);
    if (idx === -1) return null;
    list[idx] = { ...list[idx], ...updates };
    this.setExpenses(list);
    return list[idx];
  },
  deleteExpense(id) {
    this.setExpenses(this.getExpenses().filter((e) => e.id !== id));
  },

  // ---------------- 支出カテゴリ（固定費/変動費の種別マスター） ----------------
  getExpenseCategories() { return this._get(STORAGE_KEYS.expenseCategories); },
  setExpenseCategories(list) {
    this._set(STORAGE_KEYS.expenseCategories, list);
    if (typeof GasSync !== "undefined") GasSync.pushExpenseCategories();
  },
  /** カテゴリの種別（固定費/変動費）だけを更新する */
  updateExpenseCategoryType(name, type) {
    const list = this.getExpenseCategories();
    const idx = list.findIndex((c) => c.name === name);
    if (idx === -1) return;
    list[idx].type = type;
    this.setExpenseCategories(list);
  },

  // ---------------- 収入履歴 ----------------
  getIncomes() { return this._get(STORAGE_KEYS.incomes); },
  setIncomes(list) {
    this._set(STORAGE_KEYS.incomes, list);
    if (typeof GasSync !== "undefined") GasSync.pushIncomes();
  },
  addIncome(item) {
    const list = this.getIncomes();
    item.id = "IN" + Date.now() + Math.floor(Math.random() * 1000);
    list.push(item);
    this.setIncomes(list);
    return item;
  },
  updateIncome(id, updates) {
    const list = this.getIncomes();
    const idx = list.findIndex((i) => i.id === id);
    if (idx === -1) return null;
    list[idx] = { ...list[idx], ...updates };
    this.setIncomes(list);
    return list[idx];
  },
  deleteIncome(id) {
    this.setIncomes(this.getIncomes().filter((i) => i.id !== id));
  },

  // ---------------- カテゴリ別予算 ----------------
  getCategoryBudgets() { return this._get(STORAGE_KEYS.categoryBudgets); },
  setCategoryBudgets(list) {
    this._set(STORAGE_KEYS.categoryBudgets, list);
    if (typeof GasSync !== "undefined") GasSync.pushCategoryBudgets();
  },
  getCategoryBudget(yearMonth, category) {
    return this.getCategoryBudgets().find((b) => b.yearMonth === yearMonth && b.category === category) || null;
  },
  setCategoryBudget(yearMonth, category, amount) {
    const list = this.getCategoryBudgets();
    const idx = list.findIndex((b) => b.yearMonth === yearMonth && b.category === category);
    if (idx === -1) {
      list.push({ yearMonth, category, budget: amount });
    } else {
      list[idx].budget = amount;
    }
    this.setCategoryBudgets(list);
  },
  deleteCategoryBudget(yearMonth, category) {
    this.setCategoryBudgets(this.getCategoryBudgets().filter((b) => !(b.yearMonth === yearMonth && b.category === category)));
  },
  /**
   * 指定年月にそのカテゴリの予算が明示的に設定されていない場合、
   * 直近の過去月（yearMonth以前）で最後に設定された予算を自動的に引き継ぐ。
   * 「未設定の場合は前月の設定がそのまま使われる」を実現するための読み取り専用の補完。
   * 一度も設定されたことが無いカテゴリは null を返す。
   */
  getEffectiveCategoryBudget(yearMonth, category) {
    const list = this.getCategoryBudgets()
      .filter((b) => b.category === category && b.yearMonth <= yearMonth)
      .sort((a, b) => (a.yearMonth < b.yearMonth ? 1 : -1));
    return list[0] || null;
  },

  // ---------------- 1日の栄養目標 ----------------
  getNutritionTarget() {
    const raw = localStorage.getItem(STORAGE_KEYS.nutritionTarget);
    return raw ? JSON.parse(raw) : { ...INITIAL_NUTRITION_TARGET };
  },
  setNutritionTarget(target) {
    localStorage.setItem(STORAGE_KEYS.nutritionTarget, JSON.stringify(target));
    if (typeof GasSync !== "undefined") GasSync.pushNutritionTarget();
  },
};

function round2(num) {
  return Math.round(num * 100) / 100;
}
