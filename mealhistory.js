/**
 * mealhistory.js
 * ---------------------------------------------------------
 * 📋食事履歴画面のロジック（旧: 調理履歴）。
 *
 * 自炊（レシピ経由）・自炊（手動登録）・外食（一人/複数）・お菓子・ジュースを
 * 区別しつつ一箇所に集約し、栄養管理（カロリー・タンパク質・脂質・炭水化物）を
 * まとめて行えるようにする画面。
 *
 * 登録経路：
 * ・自炊（レシピ経由）：レシピ画面の「通常作成」「材料変更して作成」から自動記録
 * ・自炊（手動登録）：この画面の「＋ 手動追加」から記録（在庫には影響しない）
 * ・外食・お菓子・ジュース：🍽食費登録画面から登録すると自動で連携記録される
 *   （sourcePurchaseId で購入履歴と紐付いているため、この画面からの編集・削除は不可。
 *   　🍽食費登録側から編集・削除してください）
 *
 * 【設計メモ】
 * 編集・削除は「記録の訂正」として扱い、在庫の増減は行わない。
 * ---------------------------------------------------------
 */

const MEAL_CATEGORY_LABELS = {
  self_recipe: "自炊（レシピ）",
  self_manual: "自炊（手動）",
  eatout_solo: "外食（一人）",
  eatout_group: "外食（複数）",
  snack: "お菓子",
  drink: "ジュース",
};

const MealHistory = {
  render() {
    const container = document.getElementById("page-content");
    container.innerHTML = `
      <div class="page-header">
        <h2>📋 食事履歴</h2>
        <button class="btn btn-primary btn-round" onclick="MealHistory.openManualAdd()">＋ 手動追加</button>
      </div>
      <div class="card-list" id="meal-history-list"></div>
    `;
    this.renderList();
  },

  renderList() {
    const list = Storage.getCookedHistory().slice().sort((a, b) => (a.date < b.date ? 1 : -1));
    const container = document.getElementById("meal-history-list");
    if (list.length === 0) {
      container.innerHTML = `<p class="empty-message">食事履歴はまだありません。レシピ画面の「通常作成」、🍽食費登録の外食/その他、または「＋ 手動追加」で記録されます。</p>`;
      return;
    }
    container.innerHTML = list.map((h) => this.cardHtml(h)).join("");
  },

  cardHtml(h) {
    const categoryLabel = MEAL_CATEGORY_LABELS[h.mealCategory] || (h.isManual ? "自炊（手動）" : "自炊（レシピ）");
    const n = Utils.getMealNutrition(h);
    const isLinked = !!h.sourcePurchaseId;
    return `
      <div class="card meal-history-card">
        <div class="card-main">
          <div class="card-title">${Utils.esc(h.name)} <span class="tag tag-course">${categoryLabel}</span></div>
          <div class="card-sub">${Utils.formatDate(h.date)}　👤 ${h.servings || 1}人分</div>
          <div class="recipe-cost">食費 ${Utils.formatYen(h.cost)}</div>
          <div class="recipe-nutrition">🔥${n.kcal}kcal　P${n.protein}g　F${n.fat}g　C${n.carb}g</div>
        </div>
        <div class="card-actions">
          ${isLinked
            ? `<span class="tag-muted">🍽食費登録から編集</span>`
            : `
              <button class="btn btn-sm btn-outline" onclick="MealHistory.openEdit('${h.id}')">編集</button>
              <button class="btn btn-sm btn-danger-outline" onclick="MealHistory.confirmDelete('${h.id}')">削除</button>
            `}
        </div>
      </div>
    `;
  },

  // ------------------------------------------------------
  // 手動追加（レシピ未登録の自炊を記録。在庫には影響しない）
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
      <div class="form-group">
        <label>栄養情報（任意・分かる範囲でOK）</label>
        <div class="nutrition-input-grid">
          <input type="number" id="ch-kcal" class="input" placeholder="kcal">
          <input type="number" id="ch-protein" class="input" placeholder="タンパク質(g)">
          <input type="number" id="ch-fat" class="input" placeholder="脂質(g)">
          <input type="number" id="ch-carb" class="input" placeholder="炭水化物(g)">
        </div>
      </div>
      <p class="settings-note">レシピを使わない自炊の記録です。在庫は変動しません。</p>
    `;
    Modal.open("食事履歴を手動追加", body, [
      { label: "キャンセル", class: "btn-outline", onClick: () => Modal.close() },
      { label: "追加する", class: "btn-primary", onClick: () => MealHistory.saveManualAdd() },
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
    const kcal = Number(document.getElementById("ch-kcal").value) || 0;
    const protein = Number(document.getElementById("ch-protein").value) || 0;
    const fat = Number(document.getElementById("ch-fat").value) || 0;
    const carb = Number(document.getElementById("ch-carb").value) || 0;
    Storage.addCookedHistory({
      date, name, recipeId: null, servings: 1, cost, materials: [], isManual: true,
      mealCategory: "self_manual", kcal, protein, fat, carb,
    });
    Modal.close();
    Toast.show("食事履歴に追加しました");
    this.render();
  },

  // ------------------------------------------------------
  // 編集・削除（sourcePurchaseId が無い＝手動登録・レシピ経由のみ対象）
  // ------------------------------------------------------
  openEdit(id) {
    const h = Storage.getCookedHistoryById(id);
    if (!h) return;
    const n = Utils.getMealNutrition(h);
    const hasRecipe = h.materials && h.materials.length > 0;
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
      ${hasRecipe
        ? `<p class="settings-note">このレシピの材料から栄養価が自動計算されているため、栄養情報は編集できません（材料を変更したい場合はレシピ画面から編集してください）。</p>`
        : `
          <div class="form-group">
            <label>栄養情報（任意）</label>
            <div class="nutrition-input-grid">
              <input type="number" id="ch-kcal" class="input" placeholder="kcal" value="${n.kcal || ""}">
              <input type="number" id="ch-protein" class="input" placeholder="タンパク質(g)" value="${n.protein || ""}">
              <input type="number" id="ch-fat" class="input" placeholder="脂質(g)" value="${n.fat || ""}">
              <input type="number" id="ch-carb" class="input" placeholder="炭水化物(g)" value="${n.carb || ""}">
            </div>
          </div>
        `}
      <p class="settings-note">編集内容は記録の訂正のみです。在庫の数量には影響しません。</p>
    `;
    Modal.open("食事履歴を編集", body, [
      { label: "キャンセル", class: "btn-outline", onClick: () => Modal.close() },
      { label: "保存する", class: "btn-primary", onClick: () => MealHistory.saveEdit(id) },
    ]);
  },

  saveEdit(id) {
    const h = Storage.getCookedHistoryById(id);
    if (!h) return;
    const date = document.getElementById("ch-date").value;
    const name = document.getElementById("ch-name").value.trim();
    const servings = parseInt(document.getElementById("ch-servings").value, 10) || 1;
    const cost = Number(document.getElementById("ch-cost").value) || 0;
    if (!date || !name) {
      alert("日付とメニュー名を入力してください。");
      return;
    }
    const updates = { date, name, servings, cost };
    const hasRecipe = h.materials && h.materials.length > 0;
    if (!hasRecipe) {
      updates.kcal = Number(document.getElementById("ch-kcal").value) || 0;
      updates.protein = Number(document.getElementById("ch-protein").value) || 0;
      updates.fat = Number(document.getElementById("ch-fat").value) || 0;
      updates.carb = Number(document.getElementById("ch-carb").value) || 0;
    }
    Storage.updateCookedHistory(id, updates);
    Modal.close();
    Toast.show("食事履歴を更新しました");
    this.render();
  },

  confirmDelete(id) {
    if (!confirm("この食事履歴を削除しますか？（在庫は変動しません）")) return;
    Storage.deleteCookedHistory(id);
    Toast.show("食事履歴を削除しました");
    this.render();
  },
};
