/**
 * expense.js
 * ---------------------------------------------------------
 * 💴支出管理画面のロジック。
 *
 * 【重要】ここでは「食費」カテゴリは選べない
 * 食費（自炊・外食・お菓子・ジュース）はすべて🍽食費登録画面から
 * 登録する仕様のため、二重入力を避けるためにカテゴリの選択肢から
 * 「食費」を除外している。
 * ---------------------------------------------------------
 */

const Expense = {
  render() {
    const container = document.getElementById("page-content");
    container.innerHTML = `
      <div class="page-header">
        <h2>💴 支出管理</h2>
        <button class="btn btn-primary btn-round" onclick="Expense.openAddModal()">＋ 支出を登録</button>
      </div>

      <p class="settings-note">食費（自炊・外食・お菓子・ジュース）は🍽食費登録画面から登録してください。ここには表示されません。</p>
      <div class="card-list" id="expense-list"></div>
      <button class="btn btn-outline btn-block" style="margin-top:14px;" onclick="Expense.openCategorySettings()">⚙ カテゴリの固定費/変動費を設定</button>
    `;
    this.renderList();
  },

  renderList() {
    const list = Storage.getExpenses().slice().sort((a, b) => (a.date < b.date ? 1 : -1));
    const container = document.getElementById("expense-list");
    if (list.length === 0) {
      container.innerHTML = `<p class="empty-message">支出履歴はまだありません。</p>`;
      return;
    }
    container.innerHTML = list.map((e) => this.cardHtml(e)).join("");
  },

  cardHtml(e) {
    return `
      <div class="card expense-card">
        <div class="card-main">
          <div class="card-title">${Utils.esc(e.category)}　${Utils.formatYen(e.amount)}</div>
          <div class="card-sub">${Utils.formatDate(e.date)}${e.place ? `　${Utils.esc(e.place)}` : ""}</div>
          ${e.memo ? `<div class="card-sub">${Utils.esc(e.memo)}</div>` : ""}
        </div>
        <div class="card-actions">
          <button class="btn btn-sm btn-outline" onclick="Expense.openEdit('${e.id}')">編集</button>
          <button class="btn btn-sm btn-danger-outline" onclick="Expense.confirmDelete('${e.id}')">削除</button>
        </div>
      </div>
    `;
  },

  /** 通常の支出登録で選べるカテゴリ一覧（食費は🍽食費登録から登録するため除外） */
  _selectableCategories() {
    return Storage.getExpenseCategories().filter((c) => c.name !== "食費");
  },

  openAddModal() {
    const categories = this._selectableCategories();
    const body = `
      <div class="form-group">
        <label>日付</label>
        <input type="date" id="ex-date" class="input" value="${Utils.todayISO()}">
      </div>
      <div class="form-group">
        <label>カテゴリ</label>
        <select id="ex-category" class="input">
          ${categories.map((c) => `<option value="${Utils.esc(c.name)}">${Utils.esc(c.name)}（${c.type}）</option>`).join("")}
        </select>
      </div>
      <div class="form-group">
        <label>金額</label>
        <input type="number" id="ex-amount" class="input" placeholder="例: 5000">
      </div>
      <div class="form-group">
        <label>利用先（任意）</label>
        <input type="text" id="ex-place" class="input">
      </div>
      <div class="form-group">
        <label>メモ（任意）</label>
        <input type="text" id="ex-memo" class="input">
      </div>
    `;
    Modal.open("支出を登録", body, [
      { label: "キャンセル", class: "btn-outline", onClick: () => Modal.close() },
      { label: "登録する", class: "btn-primary", onClick: () => Expense.saveAdd() },
    ]);
  },

  saveAdd() {
    const date = document.getElementById("ex-date").value;
    const category = document.getElementById("ex-category").value;
    const amount = Number(document.getElementById("ex-amount").value);
    const place = document.getElementById("ex-place").value.trim();
    const memo = document.getElementById("ex-memo").value.trim();
    if (!date || !category || !amount || amount <= 0) {
      alert("日付・カテゴリ・金額を入力してください。");
      return;
    }
    Storage.addExpense({ date, category, amount, place, memo });
    Modal.close();
    Toast.show("支出を登録しました");
    this.renderList();
  },

  openEdit(id) {
    const e = Storage.getExpenses().find((x) => x.id === id);
    if (!e) return;

    const categories = this._selectableCategories();
    const body = `
      <div class="form-group">
        <label>日付</label>
        <input type="date" id="ex-date" class="input" value="${e.date}">
      </div>
      <div class="form-group">
        <label>カテゴリ</label>
        <select id="ex-category" class="input">
          ${categories.map((c) => `<option value="${Utils.esc(c.name)}" ${c.name === e.category ? "selected" : ""}>${Utils.esc(c.name)}（${c.type}）</option>`).join("")}
        </select>
      </div>
      <div class="form-group">
        <label>金額</label>
        <input type="number" id="ex-amount" class="input" value="${e.amount}">
      </div>
      <div class="form-group">
        <label>利用先（任意）</label>
        <input type="text" id="ex-place" class="input" value="${Utils.esc(e.place || "")}">
      </div>
      <div class="form-group">
        <label>メモ（任意）</label>
        <input type="text" id="ex-memo" class="input" value="${Utils.esc(e.memo || "")}">
      </div>
    `;
    Modal.open("支出を編集", body, [
      { label: "キャンセル", class: "btn-outline", onClick: () => Modal.close() },
      { label: "保存する", class: "btn-primary", onClick: () => Expense.saveEdit(id) },
    ]);
  },

  saveEdit(id) {
    const date = document.getElementById("ex-date").value;
    const category = document.getElementById("ex-category").value;
    const amount = Number(document.getElementById("ex-amount").value);
    const place = document.getElementById("ex-place").value.trim();
    const memo = document.getElementById("ex-memo").value.trim();
    if (!date || !category || !amount || amount <= 0) {
      alert("日付・カテゴリ・金額を入力してください。");
      return;
    }
    Storage.updateExpense(id, { date, category, amount, place, memo });
    Modal.close();
    Toast.show("支出を更新しました");
    this.renderList();
  },

  confirmDelete(id) {
    if (!confirm("この支出履歴を削除しますか？")) return;
    Storage.deleteExpense(id);
    Toast.show("支出履歴を削除しました");
    this.renderList();
  },

  // ------------------------------------------------------
  // カテゴリの固定費/変動費設定
  // ------------------------------------------------------
  openCategorySettings() {
    const categories = Storage.getExpenseCategories();
    const body = `
      <p class="settings-note">カテゴリごとに固定費/変動費を設定できます（支出登録のたびに選ぶ必要はありません）。</p>
      <div id="cat-settings-rows">
        ${categories.map((c) => `
          <div class="cat-settings-row">
            <span>${Utils.esc(c.name)}</span>
            <select class="input" onchange="Storage.updateExpenseCategoryType('${Utils.esc(c.name)}', this.value)">
              <option value="固定費" ${c.type === "固定費" ? "selected" : ""}>固定費</option>
              <option value="変動費" ${c.type === "変動費" ? "selected" : ""}>変動費</option>
            </select>
          </div>
        `).join("")}
      </div>
    `;
    Modal.open("カテゴリの種別設定", body, [
      { label: "閉じる", class: "btn-primary", onClick: () => Modal.close() },
    ]);
  },
};
