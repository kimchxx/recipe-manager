/**
 * shopping.js
 * ---------------------------------------------------------
 * 買い物リスト画面のロジック。
 * 在庫不足・レシピ不足材料から自動追加された項目を表示し、
 * 手動での追加・削除・購入登録画面への連携を行う。
 * ---------------------------------------------------------
 */

const Shopping = {
  render() {
    const container = document.getElementById("page-content");
    const list = Storage.getShoppingList();

    const cards = list.length
      ? list.map((item) => this.cardHtml(item)).join("")
      : `<p class="empty-message">買い物リストは空です。</p>`;

    container.innerHTML = `
      <div class="page-header">
        <h2>🛍️ 買い物リスト</h2>
        <button class="btn btn-primary btn-round" onclick="Shopping.openAddModal()">＋ 追加</button>
      </div>
      <div class="card-list">${cards}</div>
    `;
  },

  cardHtml(item) {
    const qtyText = item.quantity ? Utils.formatQuantity(item.quantity, item.unit) : (item.unit || "");
    return `
      <div class="card shopping-card">
        <div class="card-main">
          <div class="card-title">${Utils.esc(item.name)}</div>
          <div class="card-sub">${qtyText}</div>
          <span class="badge status-reason">${Utils.esc(item.reason || "")}</span>
        </div>
        <div class="card-actions">
          <button class="btn btn-sm btn-danger-outline" onclick="Shopping.remove('${item.id}')">削除</button>
        </div>
      </div>
    `;
  },

  openAddModal() {
    const body = `
      <div class="form-group">
        <label>食材名</label>
        <input type="text" id="sl-name" class="input" list="ingredient-name-list">
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>数量（任意）</label>
          <input type="number" id="sl-quantity" class="input" step="0.01">
        </div>
        <div class="form-group">
          <label>単位</label>
          <select id="sl-unit" class="input">${ALL_UNITS.map((u) => `<option value="${u}">${u}</option>`).join("")}</select>
        </div>
      </div>
    `;
    Modal.open("買い物リストに追加", body, [
      { label: "キャンセル", class: "btn-outline", onClick: () => Modal.close() },
      { label: "追加する", class: "btn-primary", onClick: () => Shopping.saveAdd() },
    ]);
  },

  saveAdd() {
    const name = document.getElementById("sl-name").value.trim();
    const quantity = parseFloat(document.getElementById("sl-quantity").value);
    const unit = document.getElementById("sl-unit").value;
    if (!name) {
      alert("食材名を入力してください。");
      return;
    }
    Storage.addShoppingItem({ name, quantity: isNaN(quantity) ? "" : quantity, unit, reason: "手動追加" });
    Modal.close();
    Shopping.render();
  },

  remove(id) {
    Storage.deleteShoppingItem(id);
    Shopping.render();
  },
};
