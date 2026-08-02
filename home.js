/**
 * home.js
 * ---------------------------------------------------------
 * 🏠ホーム画面（毎日確認するダッシュボード）のロジック。
 * 表示内容：今月の収入・支出・収支、残り予算、今月の食費、食費残り予算、
 * 自炊率・外食率、カテゴリ別予算使用率、在庫不足、買い物リスト、
 * 献立候補、最近作った料理、支出割合（円グラフ）。
 * ---------------------------------------------------------
 */

const Home = {
  render() {
    if (!this._yearMonth) this._yearMonth = Utils.todayISO().slice(0, 7);
    const container = document.getElementById("page-content");

    const purchases = Storage.getPurchases().filter((p) => p.date && p.date.startsWith(this._yearMonth));
    const monthTotal = purchases.reduce((s, p) => s + (p.price || 0), 0);

    const inventory = Storage.getInventory();
    const shoppingList = Storage.getShoppingList();
    const favoriteRecipes = Storage.getRecipes().filter((r) => r.favorite).slice(0, 3);
    const mealPlanRecipes = Utils.sortMealPlanRecipes(Storage.getRecipes().filter((r) => r.mealPlan));

    const budgetStats = Utils.calcBudgetStats(this._yearMonth);
    const cookedCostStats = Utils.calcDailyCookedCostStats(this._yearMonth);
    const finance = Utils.calcMonthlyFinance(this._yearMonth);
    const foodBreakdown = Utils.calcMealCategoryBreakdown(this._yearMonth);
    const categoryBudgetStats = Utils.calcCategoryBudgetStats(this._yearMonth);
    const recentCooked = Storage.getCookedHistory().slice().sort((a, b) => (a.date < b.date ? 1 : -1)).slice(0, 3);

    container.innerHTML = `
      <div class="page-header">
        <h2>🏠 ホーム</h2>
      </div>
      ${Utils.monthSwitcherHtml(this._yearMonth, "Home.changeMonth")}

      <h3 class="section-title" style="margin-top:0;">今月の家計</h3>
      <div class="card budget-card" onclick="App.navigate('monthlyreport')">
        ${this.financeCardHtml(finance)}
      </div>

      <h3 class="section-title">今月の食費予算</h3>
      <div class="card budget-card" onclick="App.navigate('analysis')">
        ${this.budgetCardHtml(budgetStats)}
      </div>

      <h3 class="section-title">自炊率・外食率</h3>
      <div class="card" onclick="App.navigate('analysis')">
        ${this.selfEatoutRatioHtml(foodBreakdown)}
      </div>

      <h3 class="section-title">支出割合</h3>
      <div class="card" onclick="App.navigate('insights')">
        ${Utils.buildDonutChartHtml(finance.byCategory, finance.totalExpense)}
      </div>

      <h3 class="section-title">カテゴリ別予算使用率</h3>
      <div class="card" onclick="App.navigate('monthlyreport')">
        ${this.categoryBudgetUsageHtml(categoryBudgetStats)}
      </div>

      <div class="home-summary-grid">
        <div class="card summary-card" onclick="App.navigate('purchase')">
          <div class="summary-label">今月の購入金額</div>
          <div class="summary-value">${Utils.formatYen(monthTotal)}</div>
          <div class="summary-sub">${purchases.length}回購入</div>
        </div>
        <div class="card summary-card" onclick="App.navigate('cookedhistory')">
          <div class="summary-label">今月の食費</div>
          <div class="summary-value">${Utils.formatYen(cookedCostStats.dailyAvg)}<span class="summary-unit">/日</span></div>
          <div class="summary-sub">食事履歴ベース・月平均</div>
        </div>
        <div class="card summary-card" onclick="App.navigate('expense')">
          <div class="summary-label">支出管理</div>
          <div class="summary-value">${Storage.getExpenses().length}<span class="summary-unit">件</span></div>
          <div class="summary-sub">食費・外食以外の支出</div>
        </div>
        <div class="card summary-card" onclick="App.navigate('inventory')">
          <div class="summary-label">在庫アイテム数</div>
          <div class="summary-value">${inventory.length}<span class="summary-unit">件</span></div>
        </div>
        <div class="card summary-card" onclick="App.navigate('recipe')">
          <div class="summary-label">登録レシピ数</div>
          <div class="summary-value">${Storage.getRecipes().length}<span class="summary-unit">件</span></div>
        </div>
        <div class="card summary-card" onclick="App.navigate('cookedhistory')">
          <div class="summary-label">食事履歴</div>
          <div class="summary-value">${Storage.getCookedHistory().length}<span class="summary-unit">件</span></div>
        </div>
      </div>

      <div class="home-quick-actions">
        <button class="btn btn-primary btn-block btn-lg" onclick="App.navigate('purchase')">🛒 食品を購入登録する</button>
      </div>

      <h3 class="section-title">⚠️ 在庫不足</h3>
      <div class="card" onclick="App.navigate('shopping')">
        ${this.shortageHtml(shoppingList)}
      </div>

      <h3 class="section-title">🍳 最近作った料理</h3>
      <div class="card-list">
        ${recentCooked.length
          ? recentCooked.map((h) => this.recentCookedCardHtml(h)).join("")
          : `<p class="empty-message">まだ食事履歴がありません。レシピ画面の「通常作成」などで記録されます。</p>`}
      </div>

      <h3 class="section-title">🔖 献立候補</h3>
      <div class="card-list">
        ${mealPlanRecipes.length
          ? mealPlanRecipes.map((r) => Recipe.mealPlanCardHtml(r)).join("")
          : `<p class="empty-message">献立候補はまだありません。レシピ画面のブックマークボタン（🔖）から追加できます。</p>`}
      </div>

      <h3 class="section-title">お気に入りレシピ</h3>
      <div class="card-list">
        ${favoriteRecipes.length
          ? favoriteRecipes.map((r) => Recipe.cardHtml(r)).join("")
          : `<p class="empty-message">お気に入りレシピはまだありません。</p>`}
      </div>
    `;
  },

  changeMonth(delta) {
    this._yearMonth = Utils.shiftYearMonth(this._yearMonth, delta);
    this.render();
  },

  /** 今月の家計サマリーカードのHTML(収支プレビュー) */
  financeCardHtml(f) {
    const positive = f.balance >= 0;
    return `
      <div class="budget-card-row">
        <div><span class="summary-label">収入</span><div class="budget-card-amount">${Utils.formatYen(f.incomeTotal)}</div></div>
        <div><span class="summary-label">支出合計</span><div class="budget-card-amount">${Utils.formatYen(f.totalExpense)}</div></div>
        <div><span class="summary-label">収支</span><div class="budget-card-amount ${positive ? "" : "over-budget"}">${positive ? "+" : ""}${Utils.formatYen(f.balance)}</div></div>
      </div>
      <div class="budget-card-sub">
        <span>固定費 ${Utils.formatYen(f.fixedTotal)}</span>
        <span>変動費 ${Utils.formatYen(f.variableTotal)}</span>
        <span>食費割合 ${Utils.formatPercent(f.foodRatio)}</span>
      </div>
    `;
  },

  /** 今月の予算サマリーカードのHTML（未設定時は設定を促す表示） */
  budgetCardHtml(stats) {
    if (stats.budget === null) {
      return `
        <div class="summary-label">今月の食費予算は未設定です</div>
        <p class="empty-message-sm">💰家計管理の「カテゴリ別予算」で「食費」を設定すると反映されます。</p>
      `;
    }
    const pct = Math.min(Math.max(stats.usageRate, 0), 100);
    const overBudget = stats.usageRate > 100;
    return `
      <div class="budget-card-row">
        <div><span class="summary-label">予算</span><div class="budget-card-amount">${Utils.formatYen(stats.budget)}</div></div>
        <div><span class="summary-label">使用金額</span><div class="budget-card-amount">${Utils.formatYen(stats.used)}</div></div>
        <div><span class="summary-label">残り予算</span><div class="budget-card-amount ${overBudget ? "over-budget" : ""}">${Utils.formatYen(stats.remaining)}</div></div>
      </div>
      <div class="bar-track budget-bar-track">
        <div class="bar-fill ${overBudget ? "bar-fill-over" : ""}" style="width:${pct}%"></div>
      </div>
      <div class="budget-card-sub">
        <span>使用率 ${Utils.formatPercent(stats.usageRate)}</span>
        <span>1日平均 ${Utils.formatYen(stats.dailyAvg)}</span>
        <span>残り1日あたり ${stats.remainingPerDay !== null ? Utils.formatYen(stats.remainingPerDay) : "-"}</span>
      </div>
    `;
  },

  /** 自炊率・外食率のミニ表示 */
  selfEatoutRatioHtml(food) {
    const total = food.selfTotal + food.eatoutTotal;
    if (total === 0) {
      return `
        <div class="split-bar-track"></div>
        <p class="empty-message-sm" style="margin-top:8px;">この月の自炊・外食データがまだありません。</p>
      `;
    }
    const selfRatio = Math.round((food.selfTotal / total) * 1000) / 10;
    const eatoutRatio = Math.round((food.eatoutTotal / total) * 1000) / 10;
    return `
      <div class="split-bar-track">
        <div class="split-bar-segment" style="width:${selfRatio}%; background:#6E8C5C;"></div>
        <div class="split-bar-segment" style="width:${eatoutRatio}%; background:#B25D45;"></div>
      </div>
      <div class="budget-card-sub">
        <span><span class="split-bar-dot" style="background:#6E8C5C;"></span>🍳 自炊 ${selfRatio}%（${Utils.formatYen(food.selfTotal)}）</span>
        <span><span class="split-bar-dot" style="background:#B25D45;"></span>🍽 外食 ${eatoutRatio}%（${Utils.formatYen(food.eatoutTotal)}）</span>
      </div>
    `;
  },

  /** カテゴリ別予算の使用率一覧（コンパクト表示） */
  categoryBudgetUsageHtml(stats) {
    if (stats.length === 0) {
      return `<p class="empty-message-sm">カテゴリ別予算はまだ設定されていません。</p>`;
    }
    return stats.map((s) => {
      const pct = Math.min(Math.max(s.rate, 0), 100);
      return `
        <div class="category-budget-mini-row">
          <span class="category-budget-mini-name">${Utils.esc(s.category)}</span>
          <div class="bar-track category-budget-mini-bar"><div class="bar-fill ${s.over ? "bar-fill-over" : ""}" style="width:${pct}%"></div></div>
          <span class="category-budget-mini-pct ${s.over ? "over-budget" : ""}">${Utils.formatPercent(s.rate)}</span>
        </div>
      `;
    }).join("");
  },

  /** 在庫不足（買い物リスト）のプレビュー */
  shortageHtml(shoppingList) {
    if (shoppingList.length === 0) {
      return `<p class="empty-message-sm">現在、不足している食材はありません。</p>`;
    }
    const preview = shoppingList.slice(0, 6);
    return `
      <div class="shortage-chip-row">
        ${preview.map((i) => `<span class="shortage-chip">${Utils.esc(i.name)}</span>`).join("")}
        ${shoppingList.length > preview.length ? `<span class="shortage-chip shortage-chip-more">+${shoppingList.length - preview.length}件</span>` : ""}
      </div>
    `;
  },

  /** 最近作った料理カード */
  recentCookedCardHtml(h) {
    return `
      <div class="card cooked-history-card" onclick="App.navigate('cookedhistory')">
        <div class="card-main">
          <div class="card-title">${Utils.esc(h.name)}${h.isManual ? ` <span class="tag-muted">手動</span>` : ""}</div>
          <div class="card-sub">${Utils.formatDate(h.date)}　👤 ${h.servings || 1}人分</div>
          <div class="recipe-cost">食費 ${Utils.formatYen(h.cost)}</div>
        </div>
      </div>
    `;
  },
};
