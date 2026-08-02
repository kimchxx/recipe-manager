/**
 * recipe.js
 * ---------------------------------------------------------
 * レシピ管理画面のロジック。
 * ・一覧表示（お気に入り上位表示）/ 検索
 * ・登録 / 編集 / 削除
 * ・詳細表示（材料費・栄養情報・不足材料追加・作ったボタン）
 * ---------------------------------------------------------
 */

const Recipe = {
  searchKeyword: "",
  courseFilter: [], // 選択中の分類フィルター（主食/主菜/副菜。複数選択可）
  genreFilter: [], // 選択中のジャンルフィルター（和食/洋食/中華...。複数選択可）
  editingMaterials: [], // 登録/編集フォームの材料一時データ
  _detailId: null, // 現在詳細表示中のレシピID（ブックマーク操作時の再描画判定用）

  // =========================================================
  // 一覧画面
  // =========================================================
  render() {
    this._detailId = null;
    const container = document.getElementById("page-content");
    container.innerHTML = `
      <div class="page-header">
        <h2>📖 レシピ</h2>
        <button class="btn btn-primary btn-round" onclick="Recipe.openForm()">＋ レシピを登録</button>
      </div>
      <div class="search-bar">
        <input type="text" id="recipe-search" class="input" placeholder="🔍 料理名・材料・ジャンル・備考で検索"
          value="${Utils.esc(this.searchKeyword)}" oninput="Recipe.onSearch(this.value)">
      </div>
      <div class="course-filter-row" id="course-filter-row">
        ${RECIPE_COURSE_TYPES.map((t) => `
          <button type="button" class="course-filter-btn ${this.courseFilter.includes(t) ? "active" : ""}" data-course="${t}" onclick="Recipe.toggleCourseFilter('${t}')">${t}</button>
        `).join("")}
      </div>
      <div class="genre-filter-row" id="genre-filter-row">
        ${RECIPE_GENRES.map((g) => `
          <button type="button" class="genre-filter-btn ${this.genreFilter.includes(g) ? "active" : ""}" data-genre="${g}" onclick="Recipe.toggleGenreFilter('${g}')">${g}</button>
        `).join("")}
      </div>
      <div class="card-list" id="recipe-list"></div>
    `;
    this.renderList();
  },

  onSearch(value) {
    this.searchKeyword = value;
    this.renderList();
  },

  /** 分類フィルターボタンのON/OFF切り替え（複数選択可。ANY一致で絞り込む） */
  toggleCourseFilter(type) {
    const idx = this.courseFilter.indexOf(type);
    if (idx === -1) this.courseFilter.push(type);
    else this.courseFilter.splice(idx, 1);

    document.querySelectorAll("#course-filter-row .course-filter-btn").forEach((btn) => {
      btn.classList.toggle("active", this.courseFilter.includes(btn.dataset.course));
    });
    this.renderList();
  },

  /** ジャンルフィルターボタンのON/OFF切り替え（複数選択可。ANY一致で絞り込む） */
  toggleGenreFilter(genre) {
    const idx = this.genreFilter.indexOf(genre);
    if (idx === -1) this.genreFilter.push(genre);
    else this.genreFilter.splice(idx, 1);

    document.querySelectorAll("#genre-filter-row .genre-filter-btn").forEach((btn) => {
      btn.classList.toggle("active", this.genreFilter.includes(btn.dataset.genre));
    });
    this.renderList();
  },

  renderList() {
    let list = Storage.getRecipes();
    const kw = this.searchKeyword.trim().toLowerCase();
    if (kw) {
      list = list.filter((r) => {
        const materialsText = r.materials.map((m) => m.name).join(" ");
        const haystack = `${r.name} ${materialsText} ${r.genre} ${r.note || ""}`.toLowerCase();
        return haystack.includes(kw);
      });
    }
    if (this.courseFilter.length > 0) {
      list = list.filter((r) => (r.courseTypes || []).some((t) => this.courseFilter.includes(t)));
    }
    if (this.genreFilter.length > 0) {
      list = list.filter((r) => this.genreFilter.includes(r.genre));
    }
    // お気に入りを上位表示、その中でも評価順
    list = list.slice().sort((a, b) => {
      if (a.favorite !== b.favorite) return a.favorite ? -1 : 1;
      return b.rating - a.rating;
    });

    const container = document.getElementById("recipe-list");
    if (list.length === 0) {
      container.innerHTML = `<p class="empty-message">該当するレシピがありません。</p>`;
      return;
    }
    container.innerHTML = list.map((r) => this.cardHtml(r)).join("");
  },

  cardHtml(r) {
    const cost = Utils.calcRecipeTotalCost(r.materials);
    const nutrition = Utils.calcRecipeNutrition(r.materials);
    const favMark = r.favorite ? `<span class="fav-mark">★</span>` : "";
    const photo = r.photoUrl
      ? `<img class="recipe-photo" src="${Utils.esc(r.photoUrl)}" alt="${Utils.esc(r.name)}" onerror="this.style.display='none'">`
      : `<div class="recipe-photo recipe-photo-placeholder">🍽️</div>`;
    const bookmarkIcon = r.mealPlan ? "📑" : "🔖";

    return `
      <div class="card recipe-card" onclick="Recipe.openDetail('${r.id}')">
        <button class="mealplan-btn ${r.mealPlan ? "active" : ""}" title="献立候補に登録/解除"
          onclick="Recipe.toggleMealPlan(event, '${r.id}')">${bookmarkIcon}</button>
        ${photo}
        <div class="card-main">
          <div class="card-title">${favMark}${Utils.esc(r.name)}</div>
          <div class="recipe-meta">
            <span class="tag">${Utils.esc(r.genre)}</span>
            ${(r.courseTypes || []).map((t) => `<span class="tag tag-course">${Utils.esc(t)}</span>`).join("")}
            <span class="tag-muted">⏱ ${r.cookTime}分　👤 ${r.servings}人分</span>
          </div>
          <div class="recipe-rating">${Utils.ratingStarsHtml(r.rating)} <span class="rating-num">${r.rating}</span></div>
          <div class="recipe-cost">材料費 ${Utils.formatYen(cost)}</div>
          <div class="recipe-nutrition">🔥${nutrition.kcal}kcal　P${nutrition.protein}g　F${nutrition.fat}g　C${nutrition.carb}g</div>
        </div>
      </div>
    `;
  },

  /** ホーム画面「献立候補」欄用の簡易カード（料理名・写真・評価・材料費・調理時間のみ） */
  mealPlanCardHtml(r) {
    const cost = Utils.calcRecipeTotalCost(r.materials);
    const photo = r.photoUrl
      ? `<img class="recipe-photo" src="${Utils.esc(r.photoUrl)}" alt="${Utils.esc(r.name)}" onerror="this.style.display='none'">`
      : `<div class="recipe-photo recipe-photo-placeholder">🍽️</div>`;
    return `
      <div class="card recipe-card mealplan-card" onclick="Recipe.openDetail('${r.id}')">
        <button class="mealplan-btn active" title="献立候補を解除"
          onclick="Recipe.toggleMealPlan(event, '${r.id}')">📑</button>
        ${photo}
        <div class="card-main">
          <div class="card-title">${Utils.esc(r.name)}</div>
          <div class="recipe-rating">${Utils.ratingStarsHtml(r.rating)} <span class="rating-num">${r.rating}</span></div>
          <div class="recipe-cost">材料費 ${Utils.formatYen(cost)}　⏱ ${r.cookTime}分</div>
        </div>
      </div>
    `;
  },

  /** 献立候補のトグル（ワンタップで登録/解除） */
  toggleMealPlan(event, id) {
    if (event) event.stopPropagation();
    const r = Storage.getRecipeById(id);
    if (!r) return;
    const next = !r.mealPlan;
    Storage.updateRecipe(id, { mealPlan: next, mealPlanAddedAt: next ? Date.now() : r.mealPlanAddedAt });
    Toast.show(next ? "献立候補に追加しました" : "献立候補を解除しました");

    // 表示中の画面に応じて即時反映する
    if (this._detailId === id) {
      this.openDetail(id);
    } else if (App.currentPage === "recipe") {
      this.renderList();
    } else if (App.currentPage === "home") {
      Home.render();
    }
  },

  // =========================================================
  // 詳細画面
  // =========================================================
  openDetail(id) {
    const r = Storage.getRecipeById(id);
    if (!r) return;
    this._detailId = id;
    const cost = Utils.calcRecipeTotalCost(r.materials);
    const nutrition = Utils.calcRecipeNutrition(r.materials);
    const photo = r.photoUrl
      ? `<img class="recipe-photo-large" src="${Utils.esc(r.photoUrl)}" alt="${Utils.esc(r.name)}" onerror="this.style.display='none'">`
      : `<div class="recipe-photo-large recipe-photo-placeholder">🍽️</div>`;
    const bookmarkIcon = r.mealPlan ? "📑" : "🔖";

    const materialsHtml = r.materials.map((m) => {
      const c = m.manualCost !== null && m.manualCost !== undefined
        ? m.manualCost
        : Utils.calcMaterialCost(m.name, m.quantity, m.unit);
      return `
        <div class="material-line">
          <span>${Utils.esc(m.name)}　${Utils.formatQuantity(m.quantity, m.unit)}</span>
          <span>${Utils.formatYen(c)}</span>
        </div>
      `;
    }).join("");

    const container = document.getElementById("page-content");
    container.innerHTML = `
      <div class="page-header">
        <button class="btn-back" onclick="Recipe.render()">← 戻る</button>
      </div>
      <div class="card recipe-detail-card">
        <div class="recipe-photo-wrap">
          ${photo}
          <button class="mealplan-btn mealplan-btn-large ${r.mealPlan ? "active" : ""}" title="献立候補に登録/解除"
            onclick="Recipe.toggleMealPlan(event, '${r.id}')">${bookmarkIcon}</button>
        </div>
        <div class="recipe-detail-title">
          ${r.favorite ? `<span class="fav-mark">★</span>` : ""}${Utils.esc(r.name)}
        </div>
        <div class="recipe-meta">
          <span class="tag">${Utils.esc(r.genre)}</span>
          ${(r.courseTypes || []).map((t) => `<span class="tag tag-course">${Utils.esc(t)}</span>`).join("")}
          <span class="tag-muted">⏱ ${r.cookTime}分　👤 ${r.servings}人分</span>
        </div>
        <div class="recipe-rating-row">
          <div class="recipe-rating">${Utils.ratingStarsHtml(r.rating)} <span class="rating-num">${r.rating}</span></div>
          <div class="recipe-cost-detail">材料費 ${Utils.formatYen(cost)}</div>
        </div>

        <h4 class="section-title-sm">材料</h4>
        <div class="material-list">${materialsHtml}</div>
        <div class="material-total">合計材料費: ${Utils.formatYen(cost)}</div>

        <h4 class="section-title-sm">栄養情報（全体量）</h4>
        <div class="nutrition-grid">
          <div class="nutrition-item"><span class="nutrition-label">カロリー</span><span>${nutrition.kcal}kcal</span></div>
          <div class="nutrition-item"><span class="nutrition-label">タンパク質</span><span>${nutrition.protein}g</span></div>
          <div class="nutrition-item"><span class="nutrition-label">脂質</span><span>${nutrition.fat}g</span></div>
          <div class="nutrition-item"><span class="nutrition-label">炭水化物</span><span>${nutrition.carb}g</span></div>
        </div>

        <h4 class="section-title-sm">作り方</h4>
        <div class="recipe-steps">${Utils.esc(r.steps).replace(/\n/g, "<br>")}</div>

        ${r.note ? `<h4 class="section-title-sm">備考</h4><div class="recipe-note">${Utils.esc(r.note).replace(/\n/g, "<br>")}</div>` : ""}

        <div class="recipe-actions">
          <div class="cook-buttons-row">
            <button class="btn btn-primary btn-lg" onclick="Recipe.cookNormal('${r.id}')">🍳 通常作成</button>
            <button class="btn btn-outline" onclick="Recipe.openCookCustomize('${r.id}')">材料変更して作成</button>
          </div>
          <button class="btn btn-outline btn-block" onclick="Recipe.addMissingToShoppingList('${r.id}')">不足材料を追加</button>
          <div class="form-row">
            <button class="btn btn-outline btn-block" onclick="Recipe.openForm('${r.id}')">編集</button>
            <button class="btn btn-danger-outline btn-block" onclick="Recipe.confirmDelete('${r.id}')">削除</button>
          </div>
        </div>
      </div>
    `;
  },

  /** 通常作成：レシピ通りの材料でワンタップで作る */
  cookNormal(id) {
    const r = Storage.getRecipeById(id);
    if (!r) return;
    if (!confirm(`「${r.name}」を作りましたか？材料分の在庫を減らします。`)) return;

    const materialsUsed = r.materials.map((m) => ({ name: m.name, quantity: m.quantity, unit: m.unit }));
    const shortages = Inventory.consumeForRecipe(materialsUsed);
    const cost = Utils.calcRecipeTotalCost(materialsUsed);

    Storage.addCookedHistory({
      date: Utils.todayISO(), recipeId: r.id, name: r.name, servings: r.servings,
      cost: cost !== null ? cost : 0, materials: materialsUsed, isManual: false, mealCategory: "self_recipe",
    });

    Toast.show(shortages.length > 0
      ? `在庫が不足していました: ${shortages.join(" / ")}`
      : "在庫を更新し、調理履歴に記録しました");
    this.openDetail(id);
  },

  /** 材料変更して作成：使用する材料のON/OFF・数量を確認してから作る */
  openCookCustomize(id) {
    const r = Storage.getRecipeById(id);
    if (!r) return;
    this._cookCustomRecipeId = id;
    this._cookCustomState = r.materials.map((m) => ({ name: m.name, quantity: m.quantity, unit: m.unit, use: true }));

    const body = `
      <p class="settings-note">使用する材料にチェックを入れ、必要に応じて数量を変更してください。チェックを外した材料の在庫は減らしません。</p>
      <div id="cook-custom-rows">${this._renderCookCustomRows()}</div>
    `;
    Modal.open(`「${r.name}」を材料変更して作る`, body, [
      { label: "キャンセル", class: "btn-outline", onClick: () => Modal.close() },
      { label: "この内容で作る", class: "btn-primary", onClick: () => Recipe.confirmCookCustom() },
    ]);
  },

  _renderCookCustomRows() {
    return this._cookCustomState.map((m, idx) => `
      <div class="cook-custom-row">
        <label class="cook-custom-checkbox">
          <input type="checkbox" ${m.use ? "checked" : ""} onchange="Recipe._toggleCookMaterial(${idx})">
          <span>${Utils.esc(m.name)}</span>
        </label>
        <input type="number" class="input cook-custom-qty" step="0.01" value="${m.quantity}"
          oninput="Recipe._updateCookMaterialQty(${idx}, this.value)">
        <span class="cook-custom-unit">${Utils.esc(m.unit)}</span>
      </div>
    `).join("");
  },

  // チェック・数量の変更は状態の更新のみ行い、モーダルの再描画は行わない
  // （入力中に要素を作り直すとフォーカスが失われるため。参考: recipe.js全体で徹底している方針）
  _toggleCookMaterial(idx) {
    this._cookCustomState[idx].use = !this._cookCustomState[idx].use;
  },
  _updateCookMaterialQty(idx, value) {
    this._cookCustomState[idx].quantity = parseFloat(value);
  },

  confirmCookCustom() {
    const id = this._cookCustomRecipeId;
    const r = Storage.getRecipeById(id);
    if (!r) return;

    const usedMaterials = this._cookCustomState
      .filter((m) => m.use && !isNaN(m.quantity) && m.quantity > 0)
      .map((m) => ({ name: m.name, quantity: m.quantity, unit: m.unit }));

    if (usedMaterials.length === 0) {
      alert("使用する材料を1つ以上選択してください。");
      return;
    }

    const shortages = Inventory.consumeForRecipe(usedMaterials);
    const cost = Utils.calcRecipeTotalCost(usedMaterials);

    Storage.addCookedHistory({
      date: Utils.todayISO(), recipeId: r.id, name: r.name, servings: r.servings,
      cost: cost !== null ? cost : 0, materials: usedMaterials, isManual: false, mealCategory: "self_recipe",
    });

    Modal.close();
    Toast.show(shortages.length > 0
      ? `在庫が不足していました: ${shortages.join(" / ")}`
      : "在庫を更新し、調理履歴に記録しました");
    this.openDetail(id);
  },

  addMissingToShoppingList(id) {
    const r = Storage.getRecipeById(id);
    if (!r) return;
    const count = Inventory.addMissingMaterialsToShoppingList(r.materials, r.name);
    Toast.show(count > 0 ? `${count}件を買い物リストに追加しました` : "不足している材料はありません");
  },

  confirmDelete(id) {
    if (confirm("このレシピを削除しますか？")) {
      Storage.deleteRecipe(id);
      this.render();
    }
  },

  // =========================================================
  // 登録・編集フォーム
  // =========================================================
  openForm(id) {
    const editing = id ? Storage.getRecipeById(id) : null;
    this.editingMaterials = editing
      ? editing.materials.map((m) => ({ ...m }))
      : [{ name: "", quantity: 1, unit: "g", manualCost: null }];

    const container = document.getElementById("page-content");
    container.innerHTML = `
      <div class="page-header">
        <button class="btn-back" onclick="${editing ? `Recipe.openDetail('${id}')` : "Recipe.render()"}">← 戻る</button>
      </div>
      <div class="card form-card">
        <h3 class="section-title">${editing ? "レシピを編集" : "レシピを登録"}</h3>

        <div class="form-group">
          <label>料理写真（任意）</label>
          <div class="photo-upload-row">
            ${editing && editing.photoUrl
              ? `<img id="rf-photo-preview" class="photo-upload-preview" src="${Utils.esc(editing.photoUrl)}" onerror="this.style.display='none'">`
              : `<img id="rf-photo-preview" class="photo-upload-preview" style="display:none;">`}
            <label class="btn btn-outline photo-upload-btn">
              📷 写真を選ぶ
              <input type="file" id="rf-photo-file" accept="image/*" style="display:none;" onchange="Photo.handleFileSelect(event)">
            </label>
          </div>
          <p class="settings-note" id="rf-photo-status"></p>
          <input type="text" id="rf-photo" class="input" placeholder="または画像URLを直接入力" value="${editing ? Utils.esc(editing.photoUrl || "") : ""}"
            oninput="Photo.updateUrlPreview(this.value)">
        </div>

        <div class="form-group">
          <label>料理名</label>
          <input type="text" id="rf-name" class="input" placeholder="例: 鯛めし" value="${editing ? Utils.esc(editing.name) : ""}">
        </div>

        <div class="form-group">
          <label>分類（複数選択可）</label>
          <div class="course-checkbox-row">
            ${RECIPE_COURSE_TYPES.map((t) => `
              <label class="course-checkbox">
                <input type="checkbox" name="rf-course" value="${t}" ${editing && (editing.courseTypes || []).includes(t) ? "checked" : ""}>
                <span>${t}</span>
              </label>
            `).join("")}
          </div>
        </div>

        <div class="form-row">
          <div class="form-group">
            <label>ジャンル</label>
            <select id="rf-genre" class="input">
              ${RECIPE_GENRES.map((g) => `<option value="${g}" ${editing && editing.genre === g ? "selected" : ""}>${g}</option>`).join("")}
            </select>
          </div>
          <div class="form-group">
            <label>調理時間（分）</label>
            <input type="number" id="rf-cooktime" class="input" value="${editing ? editing.cookTime : 30}">
          </div>
        </div>

        <div class="form-row">
          <div class="form-group">
            <label>人数</label>
            <input type="number" id="rf-servings" class="input" value="${editing ? editing.servings : 2}">
          </div>
          <div class="form-group">
            <label>評価（0.5刻み）</label>
            <input type="number" id="rf-rating" class="input" step="0.5" min="0" max="5" value="${editing ? editing.rating : 0}">
          </div>
        </div>

        <div class="form-group form-checkbox">
          <label><input type="checkbox" id="rf-favorite" ${editing && editing.favorite ? "checked" : ""}> お気に入りに登録する</label>
        </div>

        <h4 class="section-title-sm">材料</h4>
        <div id="rf-materials"></div>
        <button class="btn btn-outline btn-block" onclick="Recipe.addMaterialRow()">＋ 材料を追加</button>

        <div class="form-group" style="margin-top:16px;">
          <label>作り方</label>
          <textarea id="rf-steps" class="input textarea" rows="6" placeholder="1. ...&#10;2. ...">${editing ? Utils.esc(editing.steps) : ""}</textarea>
        </div>

        <div class="form-group">
          <label>備考</label>
          <textarea id="rf-note" class="input textarea" rows="3">${editing ? Utils.esc(editing.note || "") : ""}</textarea>
        </div>

        <button class="btn btn-primary btn-block btn-lg" onclick="Recipe.saveForm(${editing ? `'${id}'` : "null"})">
          ${editing ? "保存する" : "登録する"}
        </button>
      </div>
    `;
    this.renderMaterialRows();
  },

  addMaterialRow() {
    this.editingMaterials.push({ name: "", quantity: 1, unit: "g", manualCost: null });
    this.renderMaterialRows();
  },

  removeMaterialRow(idx) {
    this.editingMaterials.splice(idx, 1);
    if (this.editingMaterials.length === 0) this.editingMaterials.push({ name: "", quantity: 1, unit: "g", manualCost: null });
    this.renderMaterialRows();
  },

  renderMaterialRows() {
    const wrap = document.getElementById("rf-materials");
    wrap.innerHTML = this.editingMaterials.map((m, idx) => {
      const autoCost = Utils.calcMaterialCost(m.name, m.quantity, m.unit);
      const costValue = m.manualCost !== null && m.manualCost !== undefined ? m.manualCost : "";
      const costPlaceholder = autoCost !== null ? Math.round(autoCost) : "-";
      return `
        <div class="material-row">
          <input type="text" class="input row-name" placeholder="材料名" value="${Utils.esc(m.name)}"
            oninput="Recipe.updateMaterial(${idx}, 'name', this.value)" list="ingredient-name-list">
          <input type="number" class="input row-qty" step="0.01" placeholder="数量" value="${m.quantity}"
            oninput="Recipe.updateMaterial(${idx}, 'quantity', this.value)">
          <select class="input row-unit" onchange="Recipe.updateMaterial(${idx}, 'unit', this.value)">
            ${ALL_UNITS.map((u) => `<option value="${u}" ${u === m.unit ? "selected" : ""}>${u}</option>`).join("")}
          </select>
          <input type="number" class="input row-cost" placeholder="${costPlaceholder}" value="${costValue}"
            title="材料費（未入力の場合は自動計算）"
            oninput="Recipe.updateMaterial(${idx}, 'manualCost', this.value)">
          <button class="btn-icon-remove" onclick="Recipe.removeMaterialRow(${idx})" title="削除">✕</button>
        </div>
      `;
    }).join("");
  },

  updateMaterial(idx, field, value) {
    if (field === "name") {
      this.editingMaterials[idx].name = value;
      const suggested = Utils.suggestUnit(value.trim());
      if (suggested && suggested !== this.editingMaterials[idx].unit) {
        this.editingMaterials[idx].unit = suggested;
        this._syncMaterialRowUnitSelect(idx, suggested);
      }
      this._updateMaterialCostPlaceholder(idx);
      return;
    }
    if (field === "quantity") {
      this.editingMaterials[idx].quantity = parseFloat(value);
      this._updateMaterialCostPlaceholder(idx);
      return;
    }
    if (field === "unit") {
      this.editingMaterials[idx].unit = value;
      this._updateMaterialCostPlaceholder(idx);
      return;
    }
    if (field === "manualCost") {
      this.editingMaterials[idx].manualCost = value === "" ? null : parseFloat(value);
    }
  },

  /** 材料費入力欄の「未入力時の自動計算プレースホルダー」だけを再計算して反映する（行全体は再描画しない） */
  _updateMaterialCostPlaceholder(idx) {
    const m = this.editingMaterials[idx];
    const autoCost = Utils.calcMaterialCost(m.name, m.quantity, m.unit);
    const rows = document.querySelectorAll("#rf-materials .material-row");
    const row = rows[idx];
    if (!row) return;
    const costInput = row.querySelector(".row-cost");
    if (costInput) costInput.placeholder = autoCost !== null ? Math.round(autoCost) : "-";
  },

  /** 材料名から単位が自動推定された際、単位<select>の選択状態だけを反映する（行全体は再描画しない） */
  _syncMaterialRowUnitSelect(idx, unit) {
    const rows = document.querySelectorAll("#rf-materials .material-row");
    const row = rows[idx];
    if (!row) return;
    const select = row.querySelector(".row-unit");
    if (select) select.value = unit;
  },

  saveForm(id) {
    const name = document.getElementById("rf-name").value.trim();
    const genre = document.getElementById("rf-genre").value;
    const courseTypes = Array.from(document.querySelectorAll('input[name="rf-course"]:checked')).map((el) => el.value);
    const cookTime = parseInt(document.getElementById("rf-cooktime").value, 10) || 0;
    const servings = parseInt(document.getElementById("rf-servings").value, 10) || 1;
    const rating = Math.round((parseFloat(document.getElementById("rf-rating").value) || 0) * 2) / 2;
    const favorite = document.getElementById("rf-favorite").checked;
    const steps = document.getElementById("rf-steps").value.trim();
    const note = document.getElementById("rf-note").value.trim();
    const photoUrl = document.getElementById("rf-photo").value.trim();

    const materials = this.editingMaterials
      .filter((m) => m.name && m.name.trim() && !isNaN(m.quantity))
      .map((m) => ({ name: m.name.trim(), quantity: Number(m.quantity), unit: m.unit, manualCost: m.manualCost ?? null }));

    if (!name) {
      alert("料理名を入力してください。");
      return;
    }
    if (materials.length === 0) {
      alert("材料を1件以上入力してください。");
      return;
    }

    const data = { name, genre, courseTypes, cookTime, servings, rating, favorite, steps, note, photoUrl, materials };

    if (!id) {
      data.mealPlan = false;
      data.mealPlanAddedAt = null;
    }

    if (id) {
      Storage.updateRecipe(id, data);
      Toast.show("レシピを更新しました");
      this.openDetail(id);
    } else {
      const created = Storage.addRecipe(data);
      Toast.show("レシピを登録しました");
      this.openDetail(created.id);
    }
  },
};
