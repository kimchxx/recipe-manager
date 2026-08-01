/**
 * gas-sync.js
 * ---------------------------------------------------------
 * フェーズ2：Google Apps Script（GAS）Webアプリ経由での
 * スプレッドシート連携を担当するモジュール。
 *
 * 【設計方針】
 * ・GAS未設定の場合は何もしない（今までどおりlocalStorageのみで動作）
 * ・GAS設定済みの場合：
 *    - 起動時に pullAll() でスプレッドシート → localStorage へ取り込み
 *    - 各データ変更時（storage.js側から呼び出し）に該当シートを
 *      まるごと書き換える「replaceSheet」をデバウンスして送信
 * ・スプレッドシート上の見出し（日本語）と、アプリ内部で使う
 *   フィールド名（英語）の変換をこのファイルで一手に引き受ける
 * ---------------------------------------------------------
 */

const GAS_URL_KEY = "rm_gas_url";
const GAS_ACCESS_KEY_KEY = "rm_gas_access_key";
const COUNT_UNITS = ["個", "匹", "枚", "本", "合"]; // 個数系単位（栄養計算の基準が1単位あたりになるもの）

const GasSync = {
  _pushTimers: {},

  // ------------------------------------------------------
  // 設定
  // ------------------------------------------------------
  getUrl() {
    return localStorage.getItem(GAS_URL_KEY) || "";
  },
  setUrl(url) {
    localStorage.setItem(GAS_URL_KEY, url.trim());
  },
  clearUrl() {
    localStorage.removeItem(GAS_URL_KEY);
  },
  getKey() {
    return localStorage.getItem(GAS_ACCESS_KEY_KEY) || "";
  },
  setKey(key) {
    localStorage.setItem(GAS_ACCESS_KEY_KEY, key.trim());
  },
  clearKey() {
    localStorage.removeItem(GAS_ACCESS_KEY_KEY);
  },
  isConfigured() {
    return !!this.getUrl() && !!this.getKey();
  },

  /** GETリクエスト用のURL（action・アクセスキー付き）を組み立てる */
  _buildGetUrl(url, action) {
    const sep = url.includes("?") ? "&" : "?";
    return `${url}${sep}action=${action}&key=${encodeURIComponent(this.getKey())}`;
  },

  async testConnection(url, key) {
    const sep = url.includes("?") ? "&" : "?";
    const res = await fetch(`${url}${sep}action=ping&key=${encodeURIComponent(key)}`);
    const json = await res.json();
    return !!json.ok;
  },

  // ------------------------------------------------------
  // 取り込み（スプレッドシート → アプリ）
  // ------------------------------------------------------
  async pullAll() {
    const url = this.getUrl();
    if (!url || !this.getKey()) return false;
    const res = await fetch(this._buildGetUrl(url, "getAll"));
    const json = await res.json();
    if (!json.ok) throw new Error(json.error === "unauthorized" ? "アクセスキーが正しくありません" : (json.error || "取得に失敗しました"));
    const d = json.data;

    // 安全対策：接続先スプレッドシートが（見出しのみで）実質空なのに、
    // この端末には既にデータがある場合、無警告で上書きしてしまわないよう確認を挟む
    const pulledIsEmpty = ["ingredients", "recipes", "purchases", "inventory"]
      .every((k) => !(d[k] && d[k].length));
    const localHasData = Storage.getIngredients().length > 0 || Storage.getRecipes().length > 0
      || Storage.getPurchases().length > 0 || Storage.getInventory().length > 0;

    if (pulledIsEmpty && localHasData) {
      const proceed = confirm(
        "接続先のスプレッドシートにはまだデータが入っていないようです。\n" +
        "このまま同期すると、この端末に保存されている食材・レシピ・購入履歴・在庫のデータが" +
        "すべて空の状態で上書きされてしまいます。\n\n" +
        "スプレッドシート側にデータが入っていることを確認済みなら「OK」を、" +
        "そうでなければ「キャンセル」を押してスプレッドシートの中身をご確認ください" +
        "（テンプレートxlsxを使うと、サンプルデータ入りの状態から始められます）。"
      );
      if (!proceed) {
        throw new Error("スプレッドシート側が空のため、同期を中止しました");
      }
    }

    Storage.setIngredients((d.ingredients || []).map(this._mapIngredientFromSheet));
    Storage.setCategories((d.categories || []).map(this._mapCategoryFromSheet));
    Storage.setUnitConversions((d.unitConversions || []).map(this._mapUnitConversionFromSheet));
    Storage.setPurchases((d.purchases || []).map(this._mapPurchaseFromSheet));
    Storage.setInventory((d.inventory || []).map(this._mapInventoryFromSheet));

    const materials = (d.recipeMaterials || []).map(this._mapMaterialFromSheet);
    Storage.setRecipes((d.recipes || []).map((r) => this._mapRecipeFromSheet(r, materials)));

    Storage.setShoppingList((d.shoppingList || []).map(this._mapShoppingFromSheet));
    Storage.setCookedHistory((d.cookedHistory || []).map(this._mapCookedFromSheet));
    Storage.setBudgets((d.settings || []).map(this._mapBudgetFromSheet).filter((b) => b.yearMonth));

    App.renderIngredientDatalist();
    return true;
  },

  _toDateStr(v) {
    if (!v) return "";
    if (typeof v === "string") return v.includes("T") ? v.split("T")[0] : v;
    try { return new Date(v).toISOString().slice(0, 10); } catch (e) { return String(v); }
  },

  _mapIngredientFromSheet(row) {
    const unit = row["標準単位"] || "g";
    return {
      id: row["食材ID"] || Utils.uid("I"),
      name: row["食材名"],
      category: row["カテゴリ"] || "その他",
      unit,
      manageType: row["管理タイプ"] || "quantity",
      nutritionPer: COUNT_UNITS.includes(unit) ? 1 : 100,
      kcal: Number(row["kcal"]) || 0,
      protein: Number(row["タンパク質"]) || 0,
      fat: Number(row["脂質"]) || 0,
      carb: Number(row["炭水化物"]) || 0,
    };
  },
  _mapCategoryFromSheet(row) {
    return { categoryId: row["カテゴリID"], categoryName: row["カテゴリ名"] };
  },
  _mapUnitConversionFromSheet(row) {
    return { unit: row["単位"], toUnit: row["変換先"], rate: Number(row["換算値"]) || 1 };
  },
  _mapPurchaseFromSheet(row) {
    return {
      id: Utils.uid("P"),
      date: GasSync._toDateStr(row["日付"]),
      store: row["店名"],
      type: row["区分"] === "外食" ? "eatout" : "self",
      name: row["食材"] || "",
      quantity: row["数量"] === "" || row["数量"] === undefined ? "" : Number(row["数量"]),
      unit: row["単位"] || "",
      price: Number(row["金額"]) || 0,
      memo: row["メモ"] || "",
    };
  },
  _mapInventoryFromSheet(row) {
    return { id: Utils.uid("INV"), name: row["食材"], quantity: Number(row["数量"]) || 0, unit: row["単位"], status: row["状態"] || "未開封" };
  },
  _mapMaterialFromSheet(row) {
    const costRaw = row["材料費"];
    return {
      recipeId: row["レシピID"],
      name: row["材料"],
      quantity: Number(row["数量"]) || 0,
      unit: row["単位"],
      manualCost: costRaw === "" || costRaw === undefined || costRaw === null ? null : Number(costRaw),
    };
  },
  _mapRecipeFromSheet(row, allMaterials) {
    const id = row["レシピID"] || Utils.uid("R");
    const fav = row["お気に入り"];
    const mealPlan = row["献立候補"];
    const mealPlanAt = row["献立候補追加日時"];
    return {
      id,
      name: row["料理名"],
      genre: row["ジャンル"] || "その他",
      cookTime: Number(row["調理時間"]) || 0,
      servings: Number(row["人数"]) || 1,
      rating: Number(row["評価"]) || 0,
      favorite: fav === true || fav === "TRUE" || fav === "★",
      mealPlan: mealPlan === true || mealPlan === "TRUE" || mealPlan === "○",
      mealPlanAddedAt: mealPlanAt ? Number(mealPlanAt) : null,
      steps: row["作り方"] || "",
      photoUrl: row["写真URL"] || "",
      note: row["備考"] || "",
      materials: allMaterials.filter((m) => m.recipeId === id).map((m) => ({ name: m.name, quantity: m.quantity, unit: m.unit, manualCost: m.manualCost })),
    };
  },
  _mapShoppingFromSheet(row) {
    return { id: Utils.uid("SL"), name: row["食材"], quantity: row["数量"] === "" ? "" : Number(row["数量"]), unit: row["単位"], reason: row["理由"] || "", status: row["状態"] || "未購入" };
  },
  _mapCookedFromSheet(row) {
    let materials = [];
    try {
      materials = row["使用食材"] ? JSON.parse(row["使用食材"]) : [];
    } catch (e) {
      materials = [];
    }
    const manual = row["手動追加"];
    return {
      id: Utils.uid("CH"),
      date: GasSync._toDateStr(row["日付"]),
      name: row["料理名"] || "",
      recipeId: row["レシピID"] || null,
      servings: Number(row["人数"]) || 1,
      cost: Number(row["食費"]) || 0,
      materials,
      isManual: manual === true || manual === "TRUE",
    };
  },
  _mapBudgetFromSheet(row) {
    return { yearMonth: row["対象年月"], budget: Number(row["食費予算"]) || 0 };
  },

  // ------------------------------------------------------
  // 書き出し（アプリ → スプレッドシート）
  // storage.js の各 setXxx() から呼び出される
  // ------------------------------------------------------
  pushPurchases() {
    this._debouncedPush("purchases", () => Storage.getPurchases().map((p) => ({
      "日付": p.date, "店名": p.store, "区分": p.type === "eatout" ? "外食" : "自炊",
      "食材": p.name || "", "数量": p.quantity === "" || p.quantity === undefined ? "" : p.quantity,
      "単位": p.unit || "", "金額": p.price, "メモ": p.memo || "",
    })));
  },
  pushInventory() {
    this._debouncedPush("inventory", () => Storage.getInventory().map((i) => ({
      "食材": i.name, "数量": i.quantity, "単位": i.unit, "状態": i.status,
    })));
  },
  pushRecipes() {
    this._debouncedPush("recipes", () => Storage.getRecipes().map((r) => ({
      "レシピID": r.id, "料理名": r.name, "ジャンル": r.genre, "調理時間": r.cookTime, "人数": r.servings,
      "評価": r.rating, "材料費": Utils.calcRecipeTotalCost(r.materials) ?? "",
      "お気に入り": r.favorite ? "TRUE" : "FALSE",
      "献立候補": r.mealPlan ? "TRUE" : "FALSE", "献立候補追加日時": r.mealPlanAddedAt || "",
      "作り方": r.steps, "写真URL": r.photoUrl || "", "備考": r.note || "",
    })));
    this._debouncedPush("recipeMaterials", () => {
      const rows = [];
      Storage.getRecipes().forEach((r) => {
        r.materials.forEach((m) => {
          const cost = m.manualCost !== null && m.manualCost !== undefined ? m.manualCost : Utils.calcMaterialCost(m.name, m.quantity, m.unit);
          rows.push({ "レシピID": r.id, "材料": m.name, "数量": m.quantity, "単位": m.unit, "材料費": cost ?? "" });
        });
      });
      return rows;
    });
  },
  pushShoppingList() {
    this._debouncedPush("shoppingList", () => Storage.getShoppingList().map((s) => ({
      "食材": s.name, "数量": s.quantity === "" ? "" : s.quantity, "単位": s.unit, "理由": s.reason, "状態": s.status,
    })));
  },
  pushCookedHistory() {
    this._debouncedPush("cookedHistory", () => Storage.getCookedHistory().map((h) => ({
      "日付": h.date, "料理名": h.name || "", "レシピID": h.recipeId || "",
      "人数": h.servings || 1, "食費": h.cost || 0,
      "使用食材": JSON.stringify(h.materials || []), "手動追加": h.isManual ? "TRUE" : "FALSE",
    })));
  },
  pushBudgets() {
    this._debouncedPush("settings", () => Storage.getBudgets().map((b) => ({
      "対象年月": b.yearMonth, "食費予算": b.budget,
    })));
  },

  _debouncedPush(sheetKey, getRowsFn) {
    if (!this.isConfigured()) return;
    clearTimeout(this._pushTimers[sheetKey]);
    this._pushTimers[sheetKey] = setTimeout(async () => {
      try {
        const res = await fetch(this.getUrl(), {
          method: "POST",
          headers: { "Content-Type": "text/plain;charset=utf-8" }, // preflight回避のためtext/plainで送信しGAS側でJSON.parseする
          body: JSON.stringify({ action: "replaceSheet", sheet: sheetKey, rows: getRowsFn(), key: this.getKey() }),
        });
        const json = await res.json();
        if (!json.ok) throw new Error(json.error === "unauthorized" ? "アクセスキーが正しくありません" : (json.error || "同期に失敗しました"));
      } catch (err) {
        console.error("GAS sync error:", err);
        Toast.show("スプレッドシートへの同期に失敗しました（" + err.message + "）");
      }
    }, 600);
  },

  async backupNow() {
    const url = this.getUrl();
    if (!url) throw new Error("未接続です");
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({ action: "backup", key: this.getKey() }),
    });
    const json = await res.json();
    if (!json.ok) throw new Error(json.error === "unauthorized" ? "アクセスキーが正しくありません" : (json.error || "バックアップに失敗しました"));
    return json.backupUrl;
  },

  // ------------------------------------------------------
  // 設定モーダル
  // ------------------------------------------------------
  openSettings() {
    const url = this.getUrl();
    const key = this.getKey();
    const connected = !!url && !!key;
    const body = `
      <div class="form-group">
        <label>GAS ウェブアプリ URL</label>
        <input type="text" id="gas-url" class="input" placeholder="https://script.google.com/macros/s/.../exec" value="${Utils.esc(url)}">
      </div>
      <div class="form-group">
        <label>アクセスキー（合言葉）</label>
        <input type="text" id="gas-key" class="input" placeholder="Code.gs の ACCESS_KEY と同じ文字列" value="${Utils.esc(key)}">
      </div>
      <p class="settings-status">${connected ? "🟢 連携設定済み" : "⚪ 未連携（この端末のみにデータを保存中）"}</p>
      <p class="settings-note">URLとアクセスキーはこの端末のブラウザにのみ保存されます。第三者と共有しないでください。</p>
      <div id="gas-settings-actions" class="settings-actions"></div>
    `;
    Modal.open("⚙ スプレッドシート連携設定", body, [
      { label: "閉じる", class: "btn-outline", onClick: () => Modal.close() },
      { label: "保存して接続", class: "btn-primary", onClick: () => GasSync.saveAndConnect() },
    ]);

    if (connected) {
      const actions = document.getElementById("gas-settings-actions");
      actions.innerHTML = `
        <button class="btn btn-outline btn-block" onclick="GasSync.manualSync()">🔄 今すぐ同期する</button>
        <button class="btn btn-outline btn-block" onclick="GasSync.doBackup()">🗂 バックアップを作成する</button>
        <button class="btn btn-danger-outline btn-block" onclick="GasSync.disconnect()">連携を解除する</button>
      `;
    }
  },

  async saveAndConnect() {
    const url = document.getElementById("gas-url").value.trim();
    const key = document.getElementById("gas-key").value.trim();
    if (!url || !key) {
      alert("URLとアクセスキーの両方を入力してください。");
      return;
    }
    Toast.show("接続を確認しています...");
    try {
      const ok = await this.testConnection(url, key);
      if (!ok) throw new Error("URLまたはアクセスキーが正しくありません");
      this.setUrl(url);
      this.setKey(key);
      await this.pullAll();
      Modal.close();
      Toast.show("接続しました。スプレッドシートのデータを読み込みました");
      App.navigate(App.currentPage);
    } catch (err) {
      alert("接続に失敗しました。URL・アクセスキー・デプロイ設定（アクセス権限）をご確認ください。\n" + err.message);
    }
  },

  async manualSync() {
    Toast.show("同期しています...");
    try {
      await this.pullAll();
      Modal.close();
      Toast.show("最新データを取得しました");
      App.navigate(App.currentPage);
    } catch (err) {
      alert("同期に失敗しました。\n" + err.message);
    }
  },

  async doBackup() {
    Toast.show("バックアップを作成しています...");
    try {
      const backupUrl = await this.backupNow();
      Modal.close();
      Toast.show("バックアップを作成しました");
      console.log("バックアップURL:", backupUrl);
    } catch (err) {
      alert("バックアップに失敗しました。\n" + err.message);
    }
  },

  disconnect() {
    if (!confirm("連携を解除しますか？（この端末のデータはそのまま残ります）")) return;
    this.clearUrl();
    this.clearKey();
    Modal.close();
    Toast.show("連携を解除しました");
  },
};
