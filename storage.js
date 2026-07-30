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
  initialized: "rm_initialized",
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
    localStorage.setItem(STORAGE_KEYS.initialized, "true");
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

  // ---------------- 調理履歴（栄養分析用） ----------------
  getCookedHistory() { return this._get(STORAGE_KEYS.cookedHistory); },
  setCookedHistory(list) {
    this._set(STORAGE_KEYS.cookedHistory, list);
    if (typeof GasSync !== "undefined") GasSync.pushCookedHistory();
  },
  addCookedHistory(entry) {
    const list = this.getCookedHistory();
    entry.id = "CH" + Date.now() + Math.floor(Math.random() * 1000);
    list.push(entry);
    this.setCookedHistory(list);
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
};

function round2(num) {
  return Math.round(num * 100) / 100;
}
