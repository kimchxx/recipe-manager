/**
 * home.js
 * ---------------------------------------------------------
 * ホーム画面（ダッシュボード）のロジック。
 * 今月の食費、買い物リストの件数、お気に入りレシピなどを
 * 一覧できるサマリー画面。
 * ---------------------------------------------------------
 */

const Home = {
  render() {
    const container = document.getElementById("page-content");

    const purchases = Storage.getPurchases();
    const thisMonth = Utils.todayISO().slice(0, 7);
    const monthPurchases = purchases.filter((p) => p.date.startsWith(thisMonth));
    const monthTotal = monthPurchases.reduce((s, p) => s + (p.price || 0), 0);

    const inventory = Storage.getInventory();
    const shoppingList = Storage.getShoppingList();
    const favoriteRecipes = Storage.getRecipes().filter((r) => r.favorite).slice(0, 3);
    const mealPlanRecipes = Utils.sortMealPlanRecipes(Storage.getRecipes().filter((r) => r.mealPlan));

    const budgetStats = Utils.calcBudgetStats(thisMonth);

    container.innerHTML = `
      <div class="page-header">
        <h2>🏠 ホーム</h2>
      </div>

      <h3 class="section-title" style="margin-top:0;">今月の食費予算</h3>
      <div class="card budget-card" onclick="App.navigate('analysis')">
        ${this.budgetCardHtml(budgetStats)}
      </div>

      <div class="home-summary-grid">
        <div class="card summary-card" onclick="App.navigate('purchase')">
          <div class="summary-label">今月の食費</div>
          <div class="summary-value">${Utils.formatYen(monthTotal)}</div>
          <div class="summary-sub">${monthPurchases.length}回購入</div>
        </div>
        <div class="card summary-card" onclick="App.navigate('inventory')">
          <div class="summary-label">在庫アイテム数</div>
          <div class="summary-value">${inventory.length}<span class="summary-unit">件</span></div>
        </div>
        <div class="card summary-card" onclick="App.navigate('shopping')">
          <div class="summary-label">買い物リスト</div>
          <div class="summary-value">${shoppingList.length}<span class="summary-unit">件</span></div>
        </div>
        <div class="card summary-card" onclick="App.navigate('recipe')">
          <div class="summary-label">登録レシピ数</div>
          <div class="summary-value">${Storage.getRecipes().length}<span class="summary-unit">件</span></div>
        </div>
      </div>

      <div class="home-quick-actions">
        <button class="btn btn-primary btn-block btn-lg" onclick="App.navigate('purchase')">🛒 買い物を登録する</button>
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

  /** 今月の予算サマリーカードのHTML（未設定時は設定を促す表示） */
  budgetCardHtml(stats) {
    if (stats.budget === null) {
      return `
        <div class="summary-label">今月の予算は未設定です</div>
        <p class="empty-message-sm">タップして分析画面から設定できます。</p>
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
};
