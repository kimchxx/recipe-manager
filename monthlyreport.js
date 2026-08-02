/**
 * monthlyreport.js
 * ---------------------------------------------------------
 * 月次分析（家計）画面のロジック。
 * ・収入の登録・編集・削除（この画面内で完結。専用ナビは無い）
 * ・収支サマリー（収入・支出合計・収支・固定費/変動費・食費割合）
 * ・カテゴリ別支出（ドーナツグラフ＋内訳）
 * ・カテゴリ別予算（使用状況・超過表示）
 * ・前月比較
 *
 * 食費・外食は購入履歴から都度計算しており、支出履歴とは別管理。
 * 既存の「今月の食費予算」（食費のみ・analysis.js側）とは独立した、
 * カテゴリ横断の家計管理機能。
 * ---------------------------------------------------------
 */

const MonthlyReport = {
  render() {
    if (!this._yearMonth) this._yearMonth = Utils.todayISO().slice(0, 7);
    const container = document.getElementById("page-content");
    container.innerHTML = `
      <div class="page-header">
        <h2>💰 家計管理</h2>
      </div>
      ${Utils.monthSwitcherHtml(this._yearMonth, "MonthlyReport.changeMonth")}

      <h3 class="section-title" style="margin-top:0;">収支</h3>
      <div class="card" id="mr-income-card"></div>

      <h3 class="section-title">収支サマリー</h3>
      <div class="card" id="mr-summary-card"></div>

      <h3 class="section-title">カテゴリ別支出</h3>
      <div class="card" id="mr-category-card"></div>

      <h3 class="section-title">カテゴリ別予算</h3>
      <div class="card" id="mr-budget-card"></div>

      <h3 class="section-title">前月比較</h3>
      <div class="card" id="mr-compare-card"></div>
    `;
    this.renderIncome();
    this.renderSummary();
    this.renderCategoryBreakdown();
    this.renderCategoryBudgets();
    this.renderComparison();
  },

  changeMonth(delta) {
    this._yearMonth = Utils.shiftYearMonth(this._yearMonth, delta);
    this.render();
  },

  // ------------------------------------------------------
  // 収支（収入・支出をまとめて登録・編集・削除できる。専用ナビは無くこの画面内で完結）
  // ------------------------------------------------------
  renderIncome() {
    const incomes = Storage.getIncomes()
      .filter((i) => i.date && i.date.startsWith(this._yearMonth))
      .map((i) => ({ ...i, _kind: "income" }));
    const expenses = Storage.getExpenses()
      .filter((e) => e.date && e.date.startsWith(this._yearMonth) && e.category !== "食費")
      .map((e) => ({ ...e, _kind: "expense" }));
    const combined = [...incomes, ...expenses].sort((a, b) => (a.date < b.date ? 1 : -1));

    const incomeTotal = incomes.reduce((s, i) => s + (i.amount || 0), 0);
    const expenseTotal = expenses.reduce((s, e) => s + (e.amount || 0), 0);

    const el = document.getElementById("mr-income-card");
    el.innerHTML = `
      <div class="income-rows">
        ${combined.length === 0
          ? `<p class="empty-message-sm">今月の収支はまだ登録されていません。</p>`
          : combined.map((item) => {
            const isIncome = item._kind === "income";
            const label = isIncome ? (item.source || "収入") : item.category;
            return `
              <div class="purchase-item-line">
                <span>${isIncome ? "💰" : "💸"} ${Utils.formatDate(item.date)}　${Utils.esc(label)}${item.memo ? `（${Utils.esc(item.memo)}）` : ""}</span>
                <span class="purchase-item-actions">
                  <span class="purchase-item-price ${isIncome ? "income-amount" : ""}">${isIncome ? "+" : "-"}${Utils.formatYen(item.amount)}</span>
                  <button class="btn-icon-sm" onclick="MonthlyReport.openEditEntry('${item._kind}', '${item.id}')" title="編集">✎</button>
                  <button class="btn-icon-sm btn-icon-sm-danger" onclick="MonthlyReport.confirmDeleteEntry('${item._kind}', '${item.id}')" title="削除">✕</button>
                </span>
              </div>
            `;
          }).join("")}
      </div>
      <div class="purchase-item-total">収入合計 ${Utils.formatYen(incomeTotal)}　／　支出合計 ${Utils.formatYen(expenseTotal)}</div>
      <button class="btn btn-outline btn-block" style="margin-top:12px;" onclick="MonthlyReport.openAddEntry()">＋ 収支を追加</button>
    `;
  },

  // ------------------------------------------------------
  // 収支を追加（収入/支出を選んでから登録する統合フォーム）
  // ------------------------------------------------------
  openAddEntry() {
    this._entryType = "expense";
    const categories = this._selectableExpenseCategories();
    const body = `
      <div class="type-toggle" id="entry-type-toggle">
        <button type="button" class="type-toggle-btn active" data-entry-type="expense" onclick="MonthlyReport.setEntryType('expense')">💸 支出</button>
        <button type="button" class="type-toggle-btn" data-entry-type="income" onclick="MonthlyReport.setEntryType('income')">💰 収入</button>
      </div>
      <div class="form-group">
        <label>日付</label>
        <input type="date" id="entry-date" class="input" value="${Utils.todayISO()}">
      </div>
      <div class="form-group">
        <label>金額</label>
        <input type="number" id="entry-amount" class="input" placeholder="例: 5000">
      </div>
      <div class="form-group" id="entry-content-wrap">
        <label>内容（カテゴリ）</label>
        <select id="entry-content" class="input">
          ${categories.map((c) => `<option value="${Utils.esc(c.name)}">${Utils.esc(c.name)}（${c.type}）</option>`).join("")}
        </select>
        <p class="settings-note">食費（自炊・外食・お菓子・ジュース）は🍽食費登録画面から登録してください。</p>
      </div>
      <div class="form-group">
        <label>メモ（任意）</label>
        <input type="text" id="entry-memo" class="input">
      </div>
    `;
    Modal.open("収支を追加", body, [
      { label: "キャンセル", class: "btn-outline", onClick: () => Modal.close() },
      { label: "登録する", class: "btn-primary", onClick: () => MonthlyReport.saveAddEntry() },
    ]);
  },

  setEntryType(type) {
    this._entryType = type;
    document.querySelectorAll("#entry-type-toggle .type-toggle-btn").forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.entryType === type);
    });
    const wrap = document.getElementById("entry-content-wrap");
    if (type === "income") {
      wrap.innerHTML = `<label>内容（収入源）</label><input type="text" id="entry-content" class="input" placeholder="例: 給与">`;
    } else {
      const categories = this._selectableExpenseCategories();
      wrap.innerHTML = `
        <label>内容（カテゴリ）</label>
        <select id="entry-content" class="input">
          ${categories.map((c) => `<option value="${Utils.esc(c.name)}">${Utils.esc(c.name)}（${c.type}）</option>`).join("")}
        </select>
        <p class="settings-note">食費（自炊・外食・お菓子・ジュース）は🍽食費登録画面から登録してください。</p>
      `;
    }
  },

  /** 「食費」を除いた支出カテゴリ一覧（食費は専用の登録経路があるため、この統合フォームからは選ばせない） */
  _selectableExpenseCategories() {
    return Storage.getExpenseCategories().filter((c) => c.name !== "食費");
  },

  saveAddEntry() {
    const date = document.getElementById("entry-date").value;
    const amount = Number(document.getElementById("entry-amount").value);
    const content = document.getElementById("entry-content").value;
    const memo = document.getElementById("entry-memo").value.trim();
    if (!date || !amount || amount <= 0) {
      alert("日付と金額を入力してください。");
      return;
    }
    if (this._entryType === "income") {
      Storage.addIncome({ date, amount, source: content.trim(), memo });
      Toast.show("収入を登録しました");
    } else {
      if (!content) {
        alert("カテゴリを選択してください。");
        return;
      }
      Storage.addExpense({ date, amount, category: content, place: "", memo });
      Toast.show("支出を登録しました");
    }
    Modal.close();
    this.render();
  },

  openEditEntry(kind, id) {
    if (kind === "income") {
      this.openEditIncome(id);
    } else {
      this.openEditExpenseEntry(id);
    }
  },

  confirmDeleteEntry(kind, id) {
    if (kind === "income") {
      this.confirmDeleteIncome(id);
    } else {
      if (!confirm("この支出を削除しますか？")) return;
      Storage.deleteExpense(id);
      Toast.show("支出を削除しました");
      this.render();
    }
  },

  openEditExpenseEntry(id) {
    const e = Storage.getExpenses().find((x) => x.id === id);
    if (!e) return;
    const categories = this._selectableExpenseCategories();
    const body = `
      <div class="form-group">
        <label>日付</label>
        <input type="date" id="entry-edit-date" class="input" value="${e.date}">
      </div>
      <div class="form-group">
        <label>金額</label>
        <input type="number" id="entry-edit-amount" class="input" value="${e.amount}">
      </div>
      <div class="form-group">
        <label>カテゴリ</label>
        <select id="entry-edit-category" class="input">
          ${categories.map((c) => `<option value="${Utils.esc(c.name)}" ${c.name === e.category ? "selected" : ""}>${Utils.esc(c.name)}（${c.type}）</option>`).join("")}
        </select>
      </div>
      <div class="form-group">
        <label>メモ（任意）</label>
        <input type="text" id="entry-edit-memo" class="input" value="${Utils.esc(e.memo || "")}">
      </div>
    `;
    Modal.open("支出を編集", body, [
      { label: "キャンセル", class: "btn-outline", onClick: () => Modal.close() },
      { label: "保存する", class: "btn-primary", onClick: () => MonthlyReport.saveEditExpenseEntry(id) },
    ]);
  },

  saveEditExpenseEntry(id) {
    const date = document.getElementById("entry-edit-date").value;
    const amount = Number(document.getElementById("entry-edit-amount").value);
    const category = document.getElementById("entry-edit-category").value;
    const memo = document.getElementById("entry-edit-memo").value.trim();
    if (!date || !amount || amount <= 0) {
      alert("日付と金額を入力してください。");
      return;
    }
    Storage.updateExpense(id, { date, amount, category, memo });
    Modal.close();
    Toast.show("支出を更新しました");
    this.render();
  },

  openEditIncome(id) {
    const i = Storage.getIncomes().find((x) => x.id === id);
    if (!i) return;
    const body = `
      <div class="form-group">
        <label>日付</label>
        <input type="date" id="in-date" class="input" value="${i.date}">
      </div>
      <div class="form-group">
        <label>金額</label>
        <input type="number" id="in-amount" class="input" value="${i.amount}">
      </div>
      <div class="form-group">
        <label>収入源（任意）</label>
        <input type="text" id="in-source" class="input" value="${Utils.esc(i.source || "")}">
      </div>
      <div class="form-group">
        <label>メモ（任意）</label>
        <input type="text" id="in-memo" class="input" value="${Utils.esc(i.memo || "")}">
      </div>
    `;
    Modal.open("収入を編集", body, [
      { label: "キャンセル", class: "btn-outline", onClick: () => Modal.close() },
      { label: "保存する", class: "btn-primary", onClick: () => MonthlyReport.saveEditIncome(id) },
    ]);
  },

  saveEditIncome(id) {
    const date = document.getElementById("in-date").value;
    const amount = Number(document.getElementById("in-amount").value);
    const source = document.getElementById("in-source").value.trim();
    const memo = document.getElementById("in-memo").value.trim();
    if (!date || !amount || amount <= 0) {
      alert("日付と金額を入力してください。");
      return;
    }
    Storage.updateIncome(id, { date, amount, source, memo });
    Modal.close();
    Toast.show("収入を更新しました");
    this.render();
  },

  confirmDeleteIncome(id) {
    if (!confirm("この収入を削除しますか？")) return;
    Storage.deleteIncome(id);
    Toast.show("収入を削除しました");
    this.render();
  },

  // ------------------------------------------------------
  // 収支サマリー
  // ------------------------------------------------------
  renderSummary() {
    const f = Utils.calcMonthlyFinance(this._yearMonth);
    const el = document.getElementById("mr-summary-card");
    const balancePositive = f.balance >= 0;
    el.innerHTML = `
      <div class="budget-detail-grid">
        <div class="budget-detail-item"><span class="nutrition-label">収入</span><span>${Utils.formatYen(f.incomeTotal)}</span></div>
        <div class="budget-detail-item"><span class="nutrition-label">支出合計</span><span>${Utils.formatYen(f.totalExpense)}</span></div>
        <div class="budget-detail-item"><span class="nutrition-label">収支</span><span class="${balancePositive ? "" : "over-budget"}">${balancePositive ? "+" : ""}${Utils.formatYen(f.balance)}</span></div>
        <div class="budget-detail-item"><span class="nutrition-label">食費割合</span><span>${Utils.formatPercent(f.foodRatio)}</span></div>
        <div class="budget-detail-item"><span class="nutrition-label">固定費合計</span><span>${Utils.formatYen(f.fixedTotal)}</span></div>
        <div class="budget-detail-item"><span class="nutrition-label">変動費合計</span><span>${Utils.formatYen(f.variableTotal)}</span></div>
      </div>
    `;
  },

  // ------------------------------------------------------
  // カテゴリ別支出（ドーナツグラフ）
  // ------------------------------------------------------
  renderCategoryBreakdown() {
    const f = Utils.calcMonthlyFinance(this._yearMonth);
    const el = document.getElementById("mr-category-card");
    el.innerHTML = Utils.buildDonutChartHtml(f.byCategory, f.totalExpense, "支出合計");
  },

  // ------------------------------------------------------
  // カテゴリ別予算
  // ------------------------------------------------------
  renderCategoryBudgets() {
    const stats = Utils.calcCategoryBudgetStats(this._yearMonth);
    const el = document.getElementById("mr-budget-card");

    const totalBudget = stats.reduce((s, x) => s + x.budget, 0);
    const totalUsed = stats.reduce((s, x) => s + x.used, 0);
    const totalOver = totalUsed > totalBudget;
    const totalRate = totalBudget > 0 ? Math.round((totalUsed / totalBudget) * 1000) / 10 : 0;

    const totalRow = stats.length === 0 ? "" : `
      <div class="category-budget-row category-budget-row-total">
        <div class="category-budget-row-header">
          <span class="category-budget-name">合計</span>
          <span class="${totalOver ? "over-budget" : ""}">${Utils.formatYen(totalUsed)} / ${Utils.formatYen(totalBudget)}</span>
        </div>
        <div class="bar-track budget-bar-track">
          <div class="bar-fill ${totalOver ? "bar-fill-over" : ""}" style="width:${Math.min(Math.max(totalRate, 0), 100)}%"></div>
        </div>
        <div class="category-budget-row-sub">
          <span>使用率 ${Utils.formatPercent(totalRate)}</span>
          <span>${totalOver ? `⚠ 予算超過（+${Utils.formatYen(totalUsed - totalBudget)}）` : `残り ${Utils.formatYen(totalBudget - totalUsed)}`}</span>
        </div>
      </div>
    `;

    const rows = stats.map((s) => {
      const pct = Math.min(Math.max(s.rate, 0), 100);
      return `
        <div class="category-budget-row">
          <div class="category-budget-row-header">
            <span class="category-budget-name">${Utils.esc(s.category)}${s.isCarriedOver ? ` <span class="tag-muted">前月から継続</span>` : ""}</span>
            <span class="${s.over ? "over-budget" : ""}">${Utils.formatYen(s.used)} / ${Utils.formatYen(s.budget)}</span>
          </div>
          <div class="bar-track budget-bar-track">
            <div class="bar-fill ${s.over ? "bar-fill-over" : ""}" style="width:${pct}%"></div>
          </div>
          <div class="category-budget-row-sub">
            <span>使用率 ${Utils.formatPercent(s.rate)}</span>
            <span>${s.over ? `⚠ 予算超過（+${Utils.formatYen(Math.abs(s.remaining))}）` : `残り ${Utils.formatYen(s.remaining)}`}</span>
          </div>
        </div>
      `;
    }).join("");

    el.innerHTML = `
      ${stats.length === 0 ? `<p class="empty-message-sm">今月のカテゴリ別予算はまだ設定されていません。</p>` : totalRow + rows}
      <button class="btn btn-outline btn-block" style="margin-top:12px;" onclick="MonthlyReport.openSetBudget()">カテゴリ別予算を設定</button>
    `;
  },

  /**
   * カテゴリ別予算の一括編集モーダル。
   * 全カテゴリを一度に表示し、各欄には「今月の設定」または無ければ
   * 「直近の過去月からの繰越額」を初期値として入れておく。
   * 変更したいカテゴリだけ書き換えて「まとめて保存」すれば、
   * 触っていない欄は元の（＝繰越の）金額のまま保存される。
   * 各欄を入力するたびに、予算合計欄がリアルタイムで更新される。
   * ※ 食費はここでも設定可能（🍽食費登録の「今月の食費予算」と共通の値）
   */
  openSetBudget() {
    const categories = Storage.getExpenseCategories();
    const rows = categories.map((c) => {
      const effective = Storage.getEffectiveCategoryBudget(this._yearMonth, c.name);
      const value = effective ? effective.budget : "";
      return `
        <div class="cat-budget-batch-row">
          <span>${Utils.esc(c.name)}${c.name === "食費" ? "（🍽食費予算と共通）" : ""}</span>
          <input type="number" class="input" data-category="${Utils.esc(c.name)}" value="${value}" placeholder="未設定" oninput="MonthlyReport.updateBudgetBatchTotal()">
        </div>
      `;
    }).join("");

    const body = `
      <p class="settings-note">前月までの設定があれば自動で初期値に入っています。変更したいカテゴリだけ金額を書き換えて「まとめて保存」してください。空欄のままなら未設定のままになります。</p>
      <div class="cat-budget-batch-total-row">
        <span>予算合計</span>
        <span id="cat-budget-batch-total">¥0</span>
      </div>
      <div id="cat-budget-batch-rows">${rows}</div>
    `;
    Modal.open("カテゴリ別予算を設定", body, [
      { label: "キャンセル", class: "btn-outline", onClick: () => Modal.close() },
      { label: "まとめて保存", class: "btn-primary", onClick: () => MonthlyReport.saveSetBudget() },
    ]);
    this.updateBudgetBatchTotal();
  },

  /** 一括編集モーダル内の予算合計を、その場の入力値から再計算して表示する */
  updateBudgetBatchTotal() {
    const inputs = document.querySelectorAll("#cat-budget-batch-rows input[data-category]");
    let total = 0;
    inputs.forEach((input) => {
      total += Number(input.value) || 0;
    });
    const totalEl = document.getElementById("cat-budget-batch-total");
    if (totalEl) totalEl.textContent = Utils.formatYen(total);
  },

  saveSetBudget() {
    const inputs = document.querySelectorAll("#cat-budget-batch-rows input[data-category]");
    let updatedCount = 0;
    inputs.forEach((input) => {
      const category = input.dataset.category;
      const value = input.value === "" ? null : Number(input.value);
      const current = Storage.getCategoryBudget(this._yearMonth, category);
      if (value === null || value <= 0) {
        // 空欄・0円の場合、今月に明示設定が既にあれば削除する（繰越表示のみだった場合は何もしない）
        if (current) Storage.deleteCategoryBudget(this._yearMonth, category);
        return;
      }
      if (!current || current.budget !== value) {
        Storage.setCategoryBudget(this._yearMonth, category, value);
        updatedCount++;
      }
    });
    Modal.close();
    Toast.show(updatedCount > 0 ? `${updatedCount}件のカテゴリ予算を更新しました` : "変更はありませんでした");
    this.renderCategoryBudgets();
    this.renderSummary();
  },

  // ------------------------------------------------------
  // 前月比較
  // ------------------------------------------------------
  renderComparison() {
    const current = Utils.calcMonthlyFinance(this._yearMonth);
    const prevYearMonth = Utils.getPrevYearMonth(this._yearMonth);
    const prev = Utils.calcMonthlyFinance(prevYearMonth);

    const diff = current.totalExpense - prev.totalExpense;
    const diffPct = prev.totalExpense > 0 ? Math.round((diff / prev.totalExpense) * 1000) / 10 : null;
    const increased = diff > 0;

    const el = document.getElementById("mr-compare-card");
    el.innerHTML = `
      <div class="budget-detail-grid">
        <div class="budget-detail-item"><span class="nutrition-label">${prevYearMonth} の支出</span><span>${Utils.formatYen(prev.totalExpense)}</span></div>
        <div class="budget-detail-item"><span class="nutrition-label">${this._yearMonth} の支出</span><span>${Utils.formatYen(current.totalExpense)}</span></div>
      </div>
      <p class="analysis-note">
        前月比：<span class="${increased ? "over-budget" : ""}">${increased ? "+" : ""}${Utils.formatYen(diff)}</span>
        ${diffPct !== null ? `（${increased ? "+" : ""}${diffPct}%）` : ""}
        ${increased ? " 増加しています" : " 減少しています"}
      </p>
    `;
  },
};
