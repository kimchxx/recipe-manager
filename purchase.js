/**
 * purchase.js
 * ---------------------------------------------------------
 * 🍽 食費登録画面のロジック（旧: 購入登録）。
 * ・区分は3種類：自炊 / 外食 / その他（お菓子・ジュース）
 * ・自炊：食材を複数行まとめて登録し、在庫にも反映
 * ・外食・その他：金額＋栄養情報（任意）を登録
 * ・外食・その他は「食事履歴」にも自動で連携登録される
 *   （在庫やレシピには影響しない。栄養管理を食事履歴に一元化するため）
 * ---------------------------------------------------------
 */

const Purchase = {
  // 入力中の食材行（一時データ、自炊のとき使用）
  rows: [],
  // 区分: "self"(自炊) / "eatout"(外食) / "other"(その他＝お菓子・ジュース)
  type: "self",
  eatoutType: "solo", // "solo"(一人) / "group"(複数)
  otherFoodType: "snack", // "snack"(お菓子) / "drink"(ジュース)

  render() {
    this.type = "self";
    this.eatoutType = "solo";
    this.otherFoodType = "snack";
    this.rows = [{ name: "", quantity: 1, unit: "g", price: "" }];
    const container = document.getElementById("page-content");
    container.innerHTML = `
      <div class="page-header">
        <h2>🍽 食費登録</h2>
        <button class="btn btn-outline btn-round" onclick="App.navigate('inventory')">📦 在庫管理</button>
      </div>

      <div class="card form-card">
        <h3 class="section-title">食費登録</h3>

        <div class="type-toggle" id="pur-type-toggle">
          <button type="button" class="type-toggle-btn active" data-type="self" onclick="Purchase.setType('self')">🍳 自炊</button>
          <button type="button" class="type-toggle-btn" data-type="eatout" onclick="Purchase.setType('eatout')">🍽 外食</button>
          <button type="button" class="type-toggle-btn" data-type="other" onclick="Purchase.setType('other')">🍬 その他</button>
        </div>

        <div class="form-row">
          <div class="form-group">
            <label>日付</label>
            <input type="date" id="pur-date" class="input" value="${Utils.todayISO()}">
          </div>
          <div class="form-group">
            <label>店名</label>
            <input type="text" id="pur-store" class="input" placeholder="例: スーパー">
          </div>
        </div>

        <div id="pur-dynamic-area"></div>

        <div class="tax-convert-row" id="pur-tax-convert-row">
          <button class="btn btn-outline btn-sm" onclick="Purchase.convertToTaxIncluded()">税込価格に変換（+8%）</button>
        </div>

        <div class="purchase-total">
          合計金額: <span id="pur-total">0円</span>
        </div>

        <button class="btn btn-primary btn-block btn-lg" onclick="Purchase.submit()">登録する</button>
      </div>

      <h3 class="section-title">食費登録履歴</h3>
      <div class="card-list" id="pur-history"></div>
    `;
    this.renderDynamicArea();
    this.renderHistory();
  },

  // ------------------------------------------------------
  // 税込価格への変換（レシートの税抜表示金額から税込金額を計算する用途）
  // 自炊のときのみボタンを表示する
  // ------------------------------------------------------
  convertToTaxIncluded() {
    const TAX_RATE = 0.08; // 食品の軽減税率を想定

    let convertedCount = 0;
    this.rows.forEach((r) => {
      if (r.price !== "" && r.price !== null && r.price !== undefined && !isNaN(r.price)) {
        r.price = Math.round(Number(r.price) * (1 + TAX_RATE));
        convertedCount++;
      }
    });
    const priceInputs = document.querySelectorAll("#pur-rows .row-price");
    this.rows.forEach((r, idx) => {
      if (priceInputs[idx]) priceInputs[idx].value = r.price === "" ? "" : r.price;
    });
    this.updateTotal();
    Toast.show(convertedCount > 0 ? `${convertedCount}件を税込価格（+8%）に変換しました` : "金額が入力されていません");
  },

  // ------------------------------------------------------
  // 区分切り替え（自炊 / 外食 / その他）
  // ------------------------------------------------------
  setType(type) {
    this.type = type;
    document.querySelectorAll("#pur-type-toggle .type-toggle-btn").forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.type === type);
    });
    const taxRow = document.getElementById("pur-tax-convert-row");
    if (taxRow) taxRow.style.display = type === "self" ? "flex" : "none";
    this.renderDynamicArea();
  },

  /** 栄養情報の入力欄（外食・その他で共通利用） */
  _nutritionFieldsHtml(prefix) {
    return `
      <div class="form-group">
        <label>栄養情報（任意・分かる範囲でOK）</label>
        <div class="nutrition-input-grid">
          <input type="number" id="${prefix}-kcal" class="input" placeholder="kcal">
          <input type="number" id="${prefix}-protein" class="input" placeholder="タンパク質(g)">
          <input type="number" id="${prefix}-fat" class="input" placeholder="脂質(g)">
          <input type="number" id="${prefix}-carb" class="input" placeholder="炭水化物(g)">
        </div>
        <p class="settings-note">入力すると「🍽食事管理」の栄養目標グラフに反映されます。未入力の場合は0として扱われます。</p>
      </div>
    `;
  },

  renderDynamicArea() {
    const el = document.getElementById("pur-dynamic-area");
    if (this.type === "self") {
      el.innerHTML = `
        <div id="pur-rows"></div>
        <button class="btn btn-outline btn-block" onclick="Purchase.addRow()">＋ 食材を追加</button>
      `;
      this.renderRows();
    } else if (this.type === "eatout") {
      el.innerHTML = `
        <div class="form-group">
          <label>区分</label>
          <div class="type-toggle" id="pur-eatout-type-toggle">
            <button type="button" class="type-toggle-btn ${this.eatoutType === "solo" ? "active" : ""}" data-eatout-type="solo" onclick="Purchase.setEatoutType('solo')">🍜 外食（一人）</button>
            <button type="button" class="type-toggle-btn ${this.eatoutType === "group" ? "active" : ""}" data-eatout-type="group" onclick="Purchase.setEatoutType('group')">🍻 外食（複数）</button>
          </div>
        </div>
        <div class="form-group">
          <label>金額</label>
          <input type="number" id="pur-eatout-price" class="input" placeholder="例: 1200" oninput="Purchase.updateTotal()">
        </div>
        <div class="form-group">
          <label>メモ（任意）</label>
          <input type="text" id="pur-eatout-memo" class="input" placeholder="例: ランチ・同僚と（複数なら支払った合計金額を入力）">
        </div>
        ${this._nutritionFieldsHtml("pur-eatout")}
      `;
      this.updateTotal();
    } else {
      el.innerHTML = `
        <div class="form-group">
          <label>区分</label>
          <div class="type-toggle" id="pur-other-type-toggle">
            <button type="button" class="type-toggle-btn ${this.otherFoodType === "snack" ? "active" : ""}" data-other-type="snack" onclick="Purchase.setOtherFoodType('snack')">🍬 お菓子</button>
            <button type="button" class="type-toggle-btn ${this.otherFoodType === "drink" ? "active" : ""}" data-other-type="drink" onclick="Purchase.setOtherFoodType('drink')">🥤 ジュース</button>
          </div>
        </div>
        <div class="form-group">
          <label>金額</label>
          <input type="number" id="pur-other-price" class="input" placeholder="例: 300" oninput="Purchase.updateTotal()">
        </div>
        <div class="form-group">
          <label>メモ（任意）</label>
          <input type="text" id="pur-other-memo" class="input">
        </div>
        ${this._nutritionFieldsHtml("pur-other")}
      `;
      this.updateTotal();
    }
  },

  setEatoutType(eatoutType) {
    this.eatoutType = eatoutType;
    document.querySelectorAll("#pur-eatout-type-toggle .type-toggle-btn").forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.eatoutType === eatoutType);
    });
  },

  setOtherFoodType(otherFoodType) {
    this.otherFoodType = otherFoodType;
    document.querySelectorAll("#pur-other-type-toggle .type-toggle-btn").forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.otherType === otherFoodType);
    });
  },

  // ------------------------------------------------------
  // 自炊：食材行の入力
  // ------------------------------------------------------
  addRow() {
    this.rows.push({ name: "", quantity: 1, unit: "g", price: "" });
    this.renderRows();
  },

  removeRow(idx) {
    this.rows.splice(idx, 1);
    if (this.rows.length === 0) this.rows.push({ name: "", quantity: 1, unit: "g", price: "" });
    this.renderRows();
  },

  renderRows() {
    const wrap = document.getElementById("pur-rows");
    if (!wrap) return;
    wrap.innerHTML = this.rows.map((row, idx) => `
      <div class="purchase-row">
        <input type="text" class="input row-name" placeholder="食材名" value="${Utils.esc(row.name)}"
          oninput="Purchase.updateRow(${idx}, 'name', this.value)" list="ingredient-name-list">
        <input type="number" class="input row-qty" step="1" placeholder="数量" value="${row.quantity}"
          oninput="Purchase.updateRow(${idx}, 'quantity', this.value)">
        <select class="input row-unit" onchange="Purchase.updateRow(${idx}, 'unit', this.value)">
          ${ALL_UNITS.map((u) => `<option value="${u}" ${u === row.unit ? "selected" : ""}>${u}</option>`).join("")}
        </select>
        <input type="number" class="input row-price" placeholder="金額" value="${row.price}"
          oninput="Purchase.updateRow(${idx}, 'price', this.value)">
        <button class="btn-icon-remove" onclick="Purchase.removeRow(${idx})" title="削除">✕</button>
      </div>
    `).join("");
    this.updateTotal();
  },

  updateRow(idx, field, value) {
    if (field === "name") {
      this.rows[idx].name = value;
      const suggested = Utils.suggestUnit(value.trim());
      if (suggested && suggested !== this.rows[idx].unit) {
        this.rows[idx].unit = suggested;
        this._syncRowUnitSelect(idx, suggested);
      }
    } else if (field === "quantity") {
      this.rows[idx].quantity = parseFloat(value);
    } else if (field === "unit") {
      this.rows[idx].unit = value;
    } else if (field === "price") {
      this.rows[idx].price = parseFloat(value);
    }
    this.updateTotal();
  },

  /** 食材名から単位が自動推定された際、単位<select>の選択状態だけを反映する（行全体は再描画しない） */
  _syncRowUnitSelect(idx, unit) {
    const wrap = document.getElementById("pur-rows");
    if (!wrap) return;
    const rows = wrap.querySelectorAll(".purchase-row");
    const row = rows[idx];
    if (!row) return;
    const select = row.querySelector(".row-unit");
    if (select) select.value = unit;
  },

  // ------------------------------------------------------
  // 合計金額表示
  // ------------------------------------------------------
  updateTotal() {
    let total = 0;
    if (this.type === "self") {
      total = this.rows.reduce((sum, r) => sum + (isNaN(r.price) ? 0 : Number(r.price) || 0), 0);
    } else if (this.type === "eatout") {
      const priceEl = document.getElementById("pur-eatout-price");
      total = priceEl ? (Number(priceEl.value) || 0) : 0;
    } else {
      const priceEl = document.getElementById("pur-other-price");
      total = priceEl ? (Number(priceEl.value) || 0) : 0;
    }
    const el = document.getElementById("pur-total");
    if (el) el.textContent = Utils.formatYen(total);
  },

  /** 栄養入力欄から値を読み取る（未入力は0扱い） */
  _readNutritionInputs(prefix) {
    return {
      kcal: Number(document.getElementById(`${prefix}-kcal`).value) || 0,
      protein: Number(document.getElementById(`${prefix}-protein`).value) || 0,
      fat: Number(document.getElementById(`${prefix}-fat`).value) || 0,
      carb: Number(document.getElementById(`${prefix}-carb`).value) || 0,
    };
  },

  // ------------------------------------------------------
  // 登録処理
  // ------------------------------------------------------
  submit() {
    const date = document.getElementById("pur-date").value;
    const store = document.getElementById("pur-store").value.trim();
    if (!date || !store) {
      alert("日付と店名を入力してください。");
      return;
    }

    if (this.type === "self") {
      const validRows = this.rows.filter((r) => r.name && r.name.trim() && !isNaN(r.quantity) && r.quantity > 0);
      if (validRows.length === 0) {
        alert("食材を1件以上入力してください。");
        return;
      }
      validRows.forEach((row) => {
        const price = isNaN(row.price) ? 0 : Number(row.price);
        Storage.addPurchase({
          date, store, type: "self", name: row.name.trim(), quantity: Number(row.quantity), unit: row.unit, price,
        });
        Storage.addOrUpdateInventoryOnPurchase(row.name.trim(), Number(row.quantity), row.unit);
        Storage.removeShoppingItemByName(row.name.trim());
      });
      Toast.show("自炊の食費を登録しました");
    } else if (this.type === "eatout") {
      const price = Number(document.getElementById("pur-eatout-price").value);
      const memo = document.getElementById("pur-eatout-memo").value.trim();
      if (!price || price <= 0) {
        alert("金額を入力してください。");
        return;
      }
      const nutrition = this._readNutritionInputs("pur-eatout");
      const purchase = Storage.addPurchase({ date, store, type: "eatout", eatoutType: this.eatoutType, name: "", quantity: "", unit: "", price, memo });
      this._addLinkedMealHistory(purchase, this.eatoutType === "group" ? "eatout_group" : "eatout_solo", store, nutrition);
      Toast.show(this.eatoutType === "group" ? "外食（複数）を登録しました" : "外食（一人）を登録しました");
    } else {
      const price = Number(document.getElementById("pur-other-price").value);
      const memo = document.getElementById("pur-other-memo").value.trim();
      if (!price || price <= 0) {
        alert("金額を入力してください。");
        return;
      }
      const nutrition = this._readNutritionInputs("pur-other");
      const label = this.otherFoodType === "drink" ? "ジュース" : "お菓子";
      const purchase = Storage.addPurchase({ date, store, type: "other", otherFoodType: this.otherFoodType, name: "", quantity: "", unit: "", price, memo });
      this._addLinkedMealHistory(purchase, this.otherFoodType === "drink" ? "drink" : "snack", label, nutrition);
      Toast.show(`${label}を登録しました`);
    }

    this.resetFormKeepingDateStore(date, store);
  },

  /**
   * 外食・その他（お菓子/ジュース）を登録した際、食事履歴にも自動で連携登録する。
   * 購入履歴とID（sourcePurchaseId）で紐付け、編集・削除時も同期させる。
   */
  _addLinkedMealHistory(purchase, mealCategory, name, nutrition) {
    Storage.addCookedHistory({
      date: purchase.date, name, mealCategory, recipeId: null, servings: 1,
      cost: purchase.price, materials: [], isManual: true,
      kcal: nutrition.kcal, protein: nutrition.protein, fat: nutrition.fat, carb: nutrition.carb,
      sourcePurchaseId: purchase.id,
    });
  },

  /**
   * 登録後のフォームリセット。
   * ・日付／区分（自炊・外食・その他とそのサブ区分）は直前の入力を引き継ぐ
   *   （同じ日にまとめて何回かに分けて登録しやすくするため）
   * ・店名は毎回変わることが多いため、登録のたびに空欄に戻す
   */
  resetFormKeepingDateStore(date, store) {
    const keepType = this.type;
    const keepEatoutType = this.eatoutType;
    const keepOtherType = this.otherFoodType;
    this.render();
    document.getElementById("pur-date").value = date;
    if (keepType === "eatout") {
      this.setType("eatout");
      this.setEatoutType(keepEatoutType);
    } else if (keepType === "other") {
      this.setType("other");
      this.setOtherFoodType(keepOtherType);
    }
  },

  // ------------------------------------------------------
  // 食費登録履歴表示
  // ------------------------------------------------------
  renderHistory() {
    const list = Storage.getPurchases().slice().sort((a, b) => (a.date < b.date ? 1 : -1));
    const container = document.getElementById("pur-history");
    if (list.length === 0) {
      container.innerHTML = `<p class="empty-message">食費登録履歴はまだありません。</p>`;
      return;
    }

    const groups = {};
    list.forEach((p) => {
      const key = `${p.date}__${p.store}`;
      if (!groups[key]) groups[key] = { date: p.date, store: p.store, items: [] };
      groups[key].items.push(p);
    });

    container.innerHTML = Object.values(groups).map((g) => {
      const total = g.items.reduce((sum, i) => sum + (i.price || 0), 0);
      const lines = g.items.map((i) => {
        let label;
        if (i.type === "eatout") {
          label = `${i.eatoutType === "group" ? "🍻 外食（複数）" : "🍜 外食（一人）"}${i.memo ? `（${Utils.esc(i.memo)}）` : ""}`;
        } else if (i.type === "other") {
          label = `${i.otherFoodType === "drink" ? "🥤 ジュース" : "🍬 お菓子"}${i.memo ? `（${Utils.esc(i.memo)}）` : ""}`;
        } else {
          label = `${Utils.esc(i.name)} ${Utils.formatQuantity(i.quantity, i.unit)}`;
        }
        return `
          <div class="purchase-item-line">
            <span>${label}</span>
            <span class="purchase-item-actions">
              <span class="purchase-item-price">${Utils.formatYen(i.price)}</span>
              <button class="btn-icon-sm" onclick="Purchase.openEdit('${i.id}')" title="編集">✎</button>
              <button class="btn-icon-sm btn-icon-sm-danger" onclick="Purchase.confirmDelete('${i.id}')" title="削除">✕</button>
            </span>
          </div>
        `;
      }).join("");

      return `
        <div class="card purchase-history-card">
          <div class="card-main">
            <div class="card-title">${Utils.formatDate(g.date)}　${Utils.esc(g.store)}</div>
            <div class="purchase-items">${lines}</div>
            <div class="purchase-item-total">小計: ${Utils.formatYen(total)}</div>
          </div>
        </div>
      `;
    }).join("");
  },

  // ------------------------------------------------------
  // 食費登録履歴の編集・削除
  // ------------------------------------------------------
  openEdit(id) {
    const p = Storage.getPurchases().find((x) => x.id === id);
    if (!p) return;

    let body;
    if (p.type === "eatout") {
      const linked = Storage.getCookedHistory().find((h) => h.sourcePurchaseId === id) || {};
      body = `
        <div class="form-row">
          <div class="form-group"><label>日付</label><input type="date" id="edit-date" class="input" value="${p.date}"></div>
          <div class="form-group"><label>店名</label><input type="text" id="edit-store" class="input" value="${Utils.esc(p.store)}"></div>
        </div>
        <div class="form-group">
          <label>区分</label>
          <select id="edit-eatout-type" class="input">
            <option value="solo" ${p.eatoutType !== "group" ? "selected" : ""}>外食（一人）</option>
            <option value="group" ${p.eatoutType === "group" ? "selected" : ""}>外食（複数）</option>
          </select>
        </div>
        <div class="form-group"><label>金額</label><input type="number" id="edit-price" class="input" value="${p.price}"></div>
        <div class="form-group"><label>メモ（任意）</label><input type="text" id="edit-memo" class="input" value="${Utils.esc(p.memo || "")}"></div>
        <div class="form-group">
          <label>栄養情報（任意）</label>
          <div class="nutrition-input-grid">
            <input type="number" id="edit-kcal" class="input" placeholder="kcal" value="${linked.kcal || ""}">
            <input type="number" id="edit-protein" class="input" placeholder="タンパク質(g)" value="${linked.protein || ""}">
            <input type="number" id="edit-fat" class="input" placeholder="脂質(g)" value="${linked.fat || ""}">
            <input type="number" id="edit-carb" class="input" placeholder="炭水化物(g)" value="${linked.carb || ""}">
          </div>
        </div>
      `;
    } else if (p.type === "other") {
      const linked = Storage.getCookedHistory().find((h) => h.sourcePurchaseId === id) || {};
      body = `
        <div class="form-row">
          <div class="form-group"><label>日付</label><input type="date" id="edit-date" class="input" value="${p.date}"></div>
          <div class="form-group"><label>店名</label><input type="text" id="edit-store" class="input" value="${Utils.esc(p.store)}"></div>
        </div>
        <div class="form-group">
          <label>区分</label>
          <select id="edit-other-type" class="input">
            <option value="snack" ${p.otherFoodType !== "drink" ? "selected" : ""}>お菓子</option>
            <option value="drink" ${p.otherFoodType === "drink" ? "selected" : ""}>ジュース</option>
          </select>
        </div>
        <div class="form-group"><label>金額</label><input type="number" id="edit-price" class="input" value="${p.price}"></div>
        <div class="form-group"><label>メモ（任意）</label><input type="text" id="edit-memo" class="input" value="${Utils.esc(p.memo || "")}"></div>
        <div class="form-group">
          <label>栄養情報（任意）</label>
          <div class="nutrition-input-grid">
            <input type="number" id="edit-kcal" class="input" placeholder="kcal" value="${linked.kcal || ""}">
            <input type="number" id="edit-protein" class="input" placeholder="タンパク質(g)" value="${linked.protein || ""}">
            <input type="number" id="edit-fat" class="input" placeholder="脂質(g)" value="${linked.fat || ""}">
            <input type="number" id="edit-carb" class="input" placeholder="炭水化物(g)" value="${linked.carb || ""}">
          </div>
        </div>
      `;
    } else {
      body = `
        <div class="form-row">
          <div class="form-group"><label>日付</label><input type="date" id="edit-date" class="input" value="${p.date}"></div>
          <div class="form-group"><label>店名</label><input type="text" id="edit-store" class="input" value="${Utils.esc(p.store)}"></div>
        </div>
        <div class="form-group"><label>食材名</label><input type="text" id="edit-name" class="input" value="${Utils.esc(p.name)}" list="ingredient-name-list"></div>
        <div class="form-row">
          <div class="form-group"><label>数量</label><input type="number" id="edit-quantity" class="input" step="1" value="${p.quantity}"></div>
          <div class="form-group">
            <label>単位</label>
            <select id="edit-unit" class="input">
              ${ALL_UNITS.map((u) => `<option value="${u}" ${u === p.unit ? "selected" : ""}>${u}</option>`).join("")}
            </select>
          </div>
        </div>
        <div class="form-group"><label>金額</label><input type="number" id="edit-price" class="input" value="${p.price}"></div>
        <p class="settings-note">数量・単位・食材名を変更すると、在庫は一度差し引かれてから新しい内容で反映されます。</p>
      `;
    }

    Modal.open("食費登録履歴を編集", body, [
      { label: "キャンセル", class: "btn-outline", onClick: () => Modal.close() },
      { label: "保存する", class: "btn-primary", onClick: () => Purchase.saveEdit(id) },
    ]);
  },

  saveEdit(id) {
    const p = Storage.getPurchases().find((x) => x.id === id);
    if (!p) return;

    const date = document.getElementById("edit-date").value;
    const store = document.getElementById("edit-store").value.trim();
    if (!date || !store) {
      alert("日付と店名を入力してください。");
      return;
    }

    if (p.type === "self") {
      Storage.subtractInventoryOnPurchaseUndo(p.name, p.quantity, p.unit);
    }

    let updates;
    let nutrition = null;
    if (p.type === "eatout") {
      const price = Number(document.getElementById("edit-price").value);
      const memo = document.getElementById("edit-memo").value.trim();
      const eatoutType = document.getElementById("edit-eatout-type").value;
      if (!price || price <= 0) {
        alert("金額を入力してください。");
        return;
      }
      updates = { date, store, price, memo, eatoutType };
      nutrition = {
        kcal: Number(document.getElementById("edit-kcal").value) || 0,
        protein: Number(document.getElementById("edit-protein").value) || 0,
        fat: Number(document.getElementById("edit-fat").value) || 0,
        carb: Number(document.getElementById("edit-carb").value) || 0,
      };
    } else if (p.type === "other") {
      const price = Number(document.getElementById("edit-price").value);
      const memo = document.getElementById("edit-memo").value.trim();
      const otherFoodType = document.getElementById("edit-other-type").value;
      if (!price || price <= 0) {
        alert("金額を入力してください。");
        return;
      }
      updates = { date, store, price, memo, otherFoodType };
      nutrition = {
        kcal: Number(document.getElementById("edit-kcal").value) || 0,
        protein: Number(document.getElementById("edit-protein").value) || 0,
        fat: Number(document.getElementById("edit-fat").value) || 0,
        carb: Number(document.getElementById("edit-carb").value) || 0,
      };
    } else {
      const name = document.getElementById("edit-name").value.trim();
      const quantity = Number(document.getElementById("edit-quantity").value);
      const unit = document.getElementById("edit-unit").value;
      const price = Number(document.getElementById("edit-price").value) || 0;
      if (!name || isNaN(quantity) || quantity <= 0) {
        alert("食材名と数量を正しく入力してください。");
        Storage.addOrUpdateInventoryOnPurchase(p.name, p.quantity, p.unit);
        return;
      }
      updates = { date, store, name, quantity, unit, price };
    }

    Storage.updatePurchase(id, updates);

    if (p.type === "self") {
      Storage.addOrUpdateInventoryOnPurchase(updates.name, updates.quantity, updates.unit);
    } else {
      const linked = Storage.getCookedHistory().find((h) => h.sourcePurchaseId === id);
      if (linked) {
        const mealCategory = p.type === "eatout"
          ? (updates.eatoutType === "group" ? "eatout_group" : "eatout_solo")
          : (updates.otherFoodType === "drink" ? "drink" : "snack");
        const name = p.type === "eatout" ? store : (updates.otherFoodType === "drink" ? "ジュース" : "お菓子");
        Storage.updateCookedHistory(linked.id, { date, name, mealCategory, cost: updates.price, ...nutrition });
      }
    }

    Modal.close();
    Toast.show("食費登録履歴を更新しました");
    this.render();
  },

  confirmDelete(id) {
    const p = Storage.getPurchases().find((x) => x.id === id);
    if (!p) return;
    const message = p.type === "self"
      ? "この食費登録履歴を削除しますか？（対応する在庫も同時に減算されます）"
      : "この食費登録履歴を削除しますか？（連携している食事履歴も削除されます）";
    if (!confirm(message)) return;

    if (p.type === "self") {
      Storage.subtractInventoryOnPurchaseUndo(p.name, p.quantity, p.unit);
    } else {
      const linked = Storage.getCookedHistory().find((h) => h.sourcePurchaseId === id);
      if (linked) Storage.deleteCookedHistory(linked.id);
    }
    Storage.deletePurchase(id);
    Toast.show("食費登録履歴を削除しました");
    this.render();
  },
};
