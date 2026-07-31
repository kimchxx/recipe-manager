/**
 * purchase.js
 * ---------------------------------------------------------
 * 食費管理（購入登録・購入履歴）画面のロジック。
 * ・日付/店名 + 複数食材をまとめて登録（自炊）
 * ・日付/店名 + 金額のみで登録（外食）
 * ・登録時に購入履歴保存 + （自炊のみ）在庫追加 + 合計金額計算
 * ---------------------------------------------------------
 */

const Purchase = {
  // 入力中の食材行（一時データ）
  rows: [],
  // 区分: "self"(自炊/食材購入) / "eatout"(外食)
  type: "self",

  render() {
    this.type = "self";
    this.rows = [{ name: "", quantity: 1, unit: "g", price: "" }];
    const container = document.getElementById("page-content");
    container.innerHTML = `
      <div class="page-header">
        <h2>🛒 食費管理</h2>
      </div>

      <div class="card form-card">
        <h3 class="section-title">購入登録</h3>

        <div class="type-toggle" id="pur-type-toggle">
          <button type="button" class="type-toggle-btn active" data-type="self" onclick="Purchase.setType('self')">🍳 自炊（食材購入）</button>
          <button type="button" class="type-toggle-btn" data-type="eatout" onclick="Purchase.setType('eatout')">🍽 外食</button>
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

        <div class="purchase-total">
          合計金額: <span id="pur-total">0円</span>
        </div>

        <button class="btn btn-primary btn-block btn-lg" onclick="Purchase.submit()">購入登録</button>
      </div>

      <h3 class="section-title">購入履歴</h3>
      <div class="card-list" id="pur-history"></div>
    `;
    this.renderDynamicArea();
    this.renderHistory();
  },

  // ------------------------------------------------------
  // 区分切り替え（自炊 / 外食）
  // ------------------------------------------------------
  setType(type) {
    this.type = type;
    document.querySelectorAll("#pur-type-toggle .type-toggle-btn").forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.type === type);
    });
    this.renderDynamicArea();
  },

  renderDynamicArea() {
    const el = document.getElementById("pur-dynamic-area");
    if (this.type === "self") {
      el.innerHTML = `
        <div id="pur-rows"></div>
        <button class="btn btn-outline btn-block" onclick="Purchase.addRow()">＋ 食材を追加</button>
      `;
      this.renderRows();
    } else {
      el.innerHTML = `
        <div class="form-group">
          <label>金額</label>
          <input type="number" id="pur-eatout-price" class="input" placeholder="例: 1200" oninput="Purchase.updateTotal()">
        </div>
        <div class="form-group">
          <label>メモ（任意）</label>
          <input type="text" id="pur-eatout-memo" class="input" placeholder="例: ランチ・同僚と">
        </div>
      `;
      this.updateTotal();
    }
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
        <input type="number" class="input row-qty" step="0.01" placeholder="数量" value="${row.quantity}"
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
  // 合計金額表示（自炊/外食共通）
  // ------------------------------------------------------
  updateTotal() {
    let total = 0;
    if (this.type === "self") {
      total = this.rows.reduce((sum, r) => sum + (isNaN(r.price) ? 0 : Number(r.price) || 0), 0);
    } else {
      const priceEl = document.getElementById("pur-eatout-price");
      total = priceEl ? (Number(priceEl.value) || 0) : 0;
    }
    const el = document.getElementById("pur-total");
    if (el) el.textContent = Utils.formatYen(total);
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
        // 購入によって不足解消した食材は買い物リストから削除
        Storage.removeShoppingItemByName(row.name.trim());
      });
      Toast.show("購入を登録しました");
    } else {
      const price = Number(document.getElementById("pur-eatout-price").value);
      const memo = document.getElementById("pur-eatout-memo").value.trim();
      if (!price || price <= 0) {
        alert("金額を入力してください。");
        return;
      }
      // 外食は在庫・レシピに影響を与えず、食費・分析のみ対象とする
      Storage.addPurchase({ date, store, type: "eatout", name: "", quantity: "", unit: "", price, memo });
      Toast.show("外食を登録しました");
    }

    // 食材行・金額などの入力内容はリセットするが、日付・店名・区分は直前の入力を引き継ぐ
    // （同じ日・同じ店でまとめて何回かに分けて登録したい場合に、毎回入力し直さずに済むようにするため）
    this.resetFormKeepingDateStore(date, store);
  },

  resetFormKeepingDateStore(date, store) {
    const keepType = this.type;
    this.render();
    document.getElementById("pur-date").value = date;
    document.getElementById("pur-store").value = store;
    if (keepType === "eatout") {
      this.setType("eatout");
    }
  },

  // ------------------------------------------------------
  // 購入履歴表示
  // ------------------------------------------------------
  renderHistory() {
    const list = Storage.getPurchases().slice().sort((a, b) => (a.date < b.date ? 1 : -1));
    const container = document.getElementById("pur-history");
    if (list.length === 0) {
      container.innerHTML = `<p class="empty-message">購入履歴はまだありません。</p>`;
      return;
    }

    // 日付+店名でグルーピングして表示
    const groups = {};
    list.forEach((p) => {
      const key = `${p.date}__${p.store}`;
      if (!groups[key]) groups[key] = { date: p.date, store: p.store, items: [] };
      groups[key].items.push(p);
    });

    container.innerHTML = Object.values(groups).map((g) => {
      const total = g.items.reduce((sum, i) => sum + (i.price || 0), 0);
      const lines = g.items.map((i) => {
        const label = i.type === "eatout"
          ? `🍽 外食${i.memo ? `（${Utils.esc(i.memo)}）` : ""}`
          : `${Utils.esc(i.name)} ${Utils.formatQuantity(i.quantity, i.unit)}`;
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
  // 購入履歴の編集・削除
  // ------------------------------------------------------
  openEdit(id) {
    const p = Storage.getPurchases().find((x) => x.id === id);
    if (!p) return;

    let body;
    if (p.type === "eatout") {
      body = `
        <div class="form-row">
          <div class="form-group"><label>日付</label><input type="date" id="edit-date" class="input" value="${p.date}"></div>
          <div class="form-group"><label>店名</label><input type="text" id="edit-store" class="input" value="${Utils.esc(p.store)}"></div>
        </div>
        <div class="form-group"><label>金額</label><input type="number" id="edit-price" class="input" value="${p.price}"></div>
        <div class="form-group"><label>メモ（任意）</label><input type="text" id="edit-memo" class="input" value="${Utils.esc(p.memo || "")}"></div>
      `;
    } else {
      body = `
        <div class="form-row">
          <div class="form-group"><label>日付</label><input type="date" id="edit-date" class="input" value="${p.date}"></div>
          <div class="form-group"><label>店名</label><input type="text" id="edit-store" class="input" value="${Utils.esc(p.store)}"></div>
        </div>
        <div class="form-group"><label>食材名</label><input type="text" id="edit-name" class="input" value="${Utils.esc(p.name)}" list="ingredient-name-list"></div>
        <div class="form-row">
          <div class="form-group"><label>数量</label><input type="number" id="edit-quantity" class="input" step="0.01" value="${p.quantity}"></div>
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

    Modal.open("購入履歴を編集", body, [
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

    // 旧内容による在庫への影響を一度取り消す（自炊のみ）
    if (p.type === "self") {
      Storage.subtractInventoryOnPurchaseUndo(p.name, p.quantity, p.unit);
    }

    let updates;
    if (p.type === "eatout") {
      const price = Number(document.getElementById("edit-price").value);
      const memo = document.getElementById("edit-memo").value.trim();
      if (!price || price <= 0) {
        alert("金額を入力してください。");
        return;
      }
      updates = { date, store, price, memo };
    } else {
      const name = document.getElementById("edit-name").value.trim();
      const quantity = Number(document.getElementById("edit-quantity").value);
      const unit = document.getElementById("edit-unit").value;
      const price = Number(document.getElementById("edit-price").value) || 0;
      if (!name || isNaN(quantity) || quantity <= 0) {
        alert("食材名と数量を正しく入力してください。");
        // 在庫の取り消しを行った直後にバリデーションで中断すると整合性が崩れるため、取り消しを元に戻す
        Storage.addOrUpdateInventoryOnPurchase(p.name, p.quantity, p.unit);
        return;
      }
      updates = { date, store, name, quantity, unit, price };
    }

    Storage.updatePurchase(id, updates);

    // 新しい内容を在庫へ反映（自炊のみ）
    if (p.type === "self") {
      Storage.addOrUpdateInventoryOnPurchase(updates.name, updates.quantity, updates.unit);
    }

    Modal.close();
    Toast.show("購入履歴を更新しました");
    this.render();
  },

  confirmDelete(id) {
    const p = Storage.getPurchases().find((x) => x.id === id);
    if (!p) return;
    const message = p.type === "self"
      ? "この購入履歴を削除しますか？（対応する在庫も同時に減算されます）"
      : "この購入履歴を削除しますか？";
    if (!confirm(message)) return;

    if (p.type === "self") {
      Storage.subtractInventoryOnPurchaseUndo(p.name, p.quantity, p.unit);
    }
    Storage.deletePurchase(id);
    Toast.show("購入履歴を削除しました");
    this.render();
  },
};
