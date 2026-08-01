/**
 * cookedhistory.js
 * ---------------------------------------------------------
 * 調理履歴画面のロジック。
 * ・レシピの「通常作成」「材料変更して作成」で自動記録される
 * ・レシピを使わない「手動追加」にも対応（在庫には影響しない）
 * ・編集・削除に対応
 *
 * 【設計メモ】
 * 編集・削除は「記録の訂正」として扱い、在庫の増減は行わない
 * （購入履歴の編集・削除とは異なる方針）。
 * 調理という行為自体を後から取り消す/条件を変えるのは、
 * 材料が複数ある分、購入履歴以上に整合性の判断が難しいため。
 * 在庫を調整したい場合は「📦 在庫」画面から直接編集してください。
 * ---------------------------------------------------------
 */

const CookedHistory = {
  render() {
    const container = document.getElementById("page-content");
    container.innerHTML = `
      <div class="page-header">
        <h2>📋 調理履歴</h2>
        <button class="btn btn-primary btn-round" onclick="CookedHistory.openManualAdd()">＋ 手動追加</button>
      </div>
      <div class="card-list" id="cooked-history-list"></div>
    `;
    this.renderList();
  },

  renderList() {
    const list = Storage.getCookedHistory().slice().sort((a, b) => (a.date < b.date ? 1 : -1));
    const container = document.getElementById("cooked-history-list");
    if (list.length === 0) {
      container.innerHTML = `<p class="empty-message">調理履歴はまだありません。レシピ画面の「通常作成」「材料変更して作成」を押すと自動で記録されます。</p>`;
      return;
    }
    container.innerHTML = list.map((h) => this.cardHtml(h)).join("");
  },

  cardHtml(h) {
    return `
      <div class="card cooked-history-card">
        <div class="card-main">
          <div class="card-title">${Utils.esc(h.name)}${h.isManual ? ` <span class="tag-muted">手動</span>` : ""}</div>
          <div class="card-sub">${Utils.formatDate(h.date)}　👤 ${h.servings || 1}人分</div>
          <div class="recipe-cost">食費 ${Utils.formatYen(h.cost)}</div>
        </div>
        <div class="card-actions">
          <button class="btn btn-sm btn-outline" onclick="CookedHistory.openEdit('${h.id}')">編集</button>
          <button class="btn btn-sm btn-danger-outline" onclick="CookedHistory.confirmDelete('${h.id}')">削除</button>
        </div>
      </div>
    `;
  },

  // ------------------------------------------------------
  // 手動追加（レシピ未登録の料理を記録。在庫には影響しない）
  // ------------------------------------------------------
  openManualAdd() {
    const body = `
      <div class="form-group">
        <label>日付</label>
        <input type="date" id="ch-date" class="input" value="${Utils.todayISO()}">
      </div>
      <div class="form-group">
        <label>メニュー名</label>
        <input type="text" id="ch-name" class="input" placeholder="例: 麻婆豆腐">
      </div>
      <div class="form-group">
        <label>食費</label>
        <input type="number" id="ch-cost" class="input" placeholder="例: 800">
      </div>
      <p class="settings-note">レシピを使わない記録のため、在庫は変動しません。</p>
    `;
    Modal.open("調理履歴を手動追加", body, [
      { label: "キャンセル", class: "btn-outline", onClick: () => Modal.close() },
      { label: "追加する", class: "btn-primary", onClick: () => CookedHistory.saveManualAdd() },
    ]);
  },

  saveManualAdd() {
    const date = document.getElementById("ch-date").value;
    const name = document.getElementById("ch-name").value.trim();
    const cost = Number(document.getElementById("ch-cost").value) || 0;
    if (!date || !name) {
      alert("日付とメニュー名を入力してください。");
      return;
    }
    Storage.addCookedHistory({ date, name, recipeId: null, servings: 1, cost, materials: [], isManual: true });
    Modal.close();
    Toast.show("調理履歴に追加しました");
    this.render();
  },

  // ------------------------------------------------------
  // 編集・削除
  // ------------------------------------------------------
  openEdit(id) {
    const h = Storage.getCookedHistoryById(id);
    if (!h) return;
    const body = `
      <div class="form-group">
        <label>日付</label>
        <input type="date" id="ch-date" class="input" value="${h.date}">
      </div>
      <div class="form-group">
        <label>メニュー名</label>
        <input type="text" id="ch-name" class="input" value="${Utils.esc(h.name)}">
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>人数</label>
          <input type="number" id="ch-servings" class="input" value="${h.servings || 1}">
        </div>
        <div class="form-group">
          <label>食費</label>
          <input type="number" id="ch-cost" class="input" value="${h.cost}">
        </div>
      </div>
      <p class="settings-note">編集内容は記録の訂正のみです。在庫の数量には影響しません。</p>
    `;
    Modal.open("調理履歴を編集", body, [
      { label: "キャンセル", class: "btn-outline", onClick: () => Modal.close() },
      { label: "保存する", class: "btn-primary", onClick: () => CookedHistory.saveEdit(id) },
    ]);
  },

  saveEdit(id) {
    const date = document.getElementById("ch-date").value;
    const name = document.getElementById("ch-name").value.trim();
    const servings = parseInt(document.getElementById("ch-servings").value, 10) || 1;
    const cost = Number(document.getElementById("ch-cost").value) || 0;
    if (!date || !name) {
      alert("日付とメニュー名を入力してください。");
      return;
    }
    Storage.updateCookedHistory(id, { date, name, servings, cost });
    Modal.close();
    Toast.show("調理履歴を更新しました");
    this.render();
  },

  confirmDelete(id) {
    if (!confirm("この調理履歴を削除しますか？（在庫は変動しません）")) return;
    Storage.deleteCookedHistory(id);
    Toast.show("調理履歴を削除しました");
    this.render();
  },
};
