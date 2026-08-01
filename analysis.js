/**
 * analysis.js
 * ---------------------------------------------------------
 * 分析画面のロジック。
 * ・月別食費（月合計・平均・購入回数）
 * ・食材カテゴリ別支出
 * ・栄養分析（作った料理の平均カロリー・PFC）
 * ---------------------------------------------------------
 */

const Analysis = {
  render() {
    const container = document.getElementById("page-content");
    container.innerHTML = `
      <div class="page-header">
        <h2>📊 分析</h2>
      </div>

      <h3 class="section-title" style="margin-top:0;">今月の食費予算</h3>
      <div class="card" id="analysis-budget"></div>

      <h3 class="section-title">月別食費</h3>
      <div class="card" id="analysis-monthly"></div>

      <h3 class="section-title">食材カテゴリ別支出</h3>
      <div class="card" id="analysis-category"></div>

      <h3 class="section-title">栄養分析（作った料理の平均）</h3>
      <div class="card" id="analysis-nutrition"></div>
    `;
    this.renderBudget();
    this.renderMonthly();
    this.renderCategory();
    this.renderNutrition();
  },

  // ------------------------------------------------------
  // 今月の食費予算・外食/自炊
  // ------------------------------------------------------
  renderBudget() {
    const yearMonth = Utils.todayISO().slice(0, 7);
    const stats = Utils.calcBudgetStats(yearMonth);
    const el = document.getElementById("analysis-budget");

    const overBudget = stats.budget !== null && stats.usageRate > 100;
    const pct = stats.budget !== null ? Math.min(Math.max(stats.usageRate, 0), 100) : 0;

    const budgetSection = stats.budget === null
      ? `<p class="empty-message">今月（${yearMonth}）の予算が未設定です。</p>`
      : `
        <div class="budget-detail-grid">
          <div class="budget-detail-item"><span class="nutrition-label">今月の予算</span><span>${Utils.formatYen(stats.budget)}</span></div>
          <div class="budget-detail-item"><span class="nutrition-label">現在の使用金額</span><span>${Utils.formatYen(stats.used)}</span></div>
          <div class="budget-detail-item"><span class="nutrition-label">残り予算</span><span class="${overBudget ? "over-budget" : ""}">${Utils.formatYen(stats.remaining)}</span></div>
          <div class="budget-detail-item"><span class="nutrition-label">予算使用率</span><span>${Utils.formatPercent(stats.usageRate)}</span></div>
          <div class="budget-detail-item"><span class="nutrition-label">1日あたりの平均使用金額</span><span>${Utils.formatYen(stats.dailyAvg)}</span></div>
          <div class="budget-detail-item"><span class="nutrition-label">月末予想金額</span><span>${Utils.formatYen(stats.projectedTotal)}</span></div>
          <div class="budget-detail-item"><span class="nutrition-label">残り1日あたり使用可能金額</span><span>${stats.remainingPerDay !== null ? Utils.formatYen(stats.remainingPerDay) : "-"}</span></div>
        </div>
        <div class="bar-track budget-bar-track">
          <div class="bar-fill ${overBudget ? "bar-fill-over" : ""}" style="width:${pct}%"></div>
        </div>
      `;

    el.innerHTML = `
      ${budgetSection}
      <button class="btn btn-outline btn-block" style="margin-top:14px;" onclick="Analysis.openBudgetModal()">
        ${stats.budget === null ? "予算を設定する" : "予算を変更する"}
      </button>

      <h4 class="section-title-sm">外食・自炊の内訳</h4>
      <div class="budget-detail-grid">
        <div class="budget-detail-item"><span class="nutrition-label">自炊費</span><span>${Utils.formatYen(stats.selfTotal)}</span></div>
        <div class="budget-detail-item"><span class="nutrition-label">外食費</span><span>${Utils.formatYen(stats.eatoutTotal)}</span></div>
        <div class="budget-detail-item"><span class="nutrition-label">自炊比率</span><span>${Utils.formatPercent(stats.selfRatio)}</span></div>
        <div class="budget-detail-item"><span class="nutrition-label">外食比率</span><span>${Utils.formatPercent(stats.eatoutRatio)}</span></div>
      </div>
    `;
  },

  openBudgetModal() {
    const yearMonth = Utils.todayISO().slice(0, 7);
    const current = Storage.getBudgetForMonth(yearMonth);
    const body = `
      <div class="form-group">
        <label>${yearMonth} の食費予算</label>
        <input type="number" id="budget-input" class="input" placeholder="例: 30000" value="${current ? current.budget : ""}">
      </div>
    `;
    Modal.open("今月の食費予算を設定", body, [
      { label: "キャンセル", class: "btn-outline", onClick: () => Modal.close() },
      { label: "保存する", class: "btn-primary", onClick: () => Analysis.saveBudget() },
    ]);
  },

  saveBudget() {
    const yearMonth = Utils.todayISO().slice(0, 7);
    const value = Number(document.getElementById("budget-input").value);
    if (!value || value <= 0) {
      alert("予算金額を入力してください。");
      return;
    }
    Storage.setBudgetForMonth(yearMonth, value);
    Modal.close();
    Toast.show("予算を設定しました");
    this.renderBudget();
  },

  renderMonthly() {
    const purchases = Storage.getPurchases();
    const el = document.getElementById("analysis-monthly");
    if (purchases.length === 0) {
      el.innerHTML = `<p class="empty-message">購入履歴がありません。</p>`;
      return;
    }

    const groups = {};
    purchases.forEach((p) => {
      const month = p.date.slice(0, 7); // YYYY-MM
      if (!groups[month]) groups[month] = { total: 0, count: 0 };
      groups[month].total += p.price || 0;
      groups[month].count += 1;
    });

    const months = Object.keys(groups).sort().reverse();
    const maxTotal = Math.max(...months.map((m) => groups[m].total));

    el.innerHTML = months.map((m) => {
      const g = groups[m];
      const avg = Math.round(g.total / g.count);
      const barWidth = maxTotal > 0 ? Math.round((g.total / maxTotal) * 100) : 0;
      const [y, mo] = m.split("-");
      return `
        <div class="analysis-row">
          <div class="analysis-row-label">${y}年${Number(mo)}月</div>
          <div class="bar-track"><div class="bar-fill" style="width:${barWidth}%"></div></div>
          <div class="analysis-row-values">
            <span>合計 ${Utils.formatYen(g.total)}</span>
            <span>平均 ${Utils.formatYen(avg)}</span>
            <span>${g.count}回購入</span>
          </div>
        </div>
      `;
    }).join("");
  },

  renderCategory() {
    const purchases = Storage.getPurchases().filter((p) => p.type !== "eatout");
    const el = document.getElementById("analysis-category");
    if (purchases.length === 0) {
      el.innerHTML = `<p class="empty-message">購入履歴がありません。</p>`;
      return;
    }

    const groups = {};
    purchases.forEach((p) => {
      const cat = Utils.getIngredientCategory(p.name);
      groups[cat] = (groups[cat] || 0) + (p.price || 0);
    });

    const cats = Object.keys(groups).sort((a, b) => groups[b] - groups[a]);
    const maxTotal = Math.max(...cats.map((c) => groups[c]));
    const total = cats.reduce((s, c) => s + groups[c], 0);

    el.innerHTML = cats.map((c) => {
      const barWidth = maxTotal > 0 ? Math.round((groups[c] / maxTotal) * 100) : 0;
      const pct = total > 0 ? Math.round((groups[c] / total) * 100) : 0;
      return `
        <div class="analysis-row">
          <div class="analysis-row-label">${Utils.esc(c)}</div>
          <div class="bar-track"><div class="bar-fill bar-fill-accent" style="width:${barWidth}%"></div></div>
          <div class="analysis-row-values">
            <span>${Utils.formatYen(groups[c])}</span>
            <span>${pct}%</span>
          </div>
        </div>
      `;
    }).join("");
  },

  renderNutrition() {
    const history = Storage.getCookedHistory();
    const el = document.getElementById("analysis-nutrition");
    if (history.length === 0) {
      el.innerHTML = `<p class="empty-message">調理履歴がまだありません。レシピ画面で「通常作成」「材料変更して作成」を押すと集計されます。</p>`;
      return;
    }

    const totals = { kcal: 0, protein: 0, fat: 0, carb: 0 };
    let count = 0;
    history.forEach((h) => {
      // 手動追加（材料情報なし）は栄養計算の対象外
      if (!h.materials || h.materials.length === 0) return;
      const n = Utils.calcRecipeNutrition(h.materials);
      totals.kcal += n.kcal;
      totals.protein += n.protein;
      totals.fat += n.fat;
      totals.carb += n.carb;
      count++;
    });

    if (count === 0) {
      el.innerHTML = `<p class="empty-message">集計できるデータがありません（手動追加の記録には材料情報が無いため対象外です）。</p>`;
      return;
    }

    el.innerHTML = `
      <div class="nutrition-grid">
        <div class="nutrition-item"><span class="nutrition-label">平均カロリー</span><span>${Math.round(totals.kcal / count)}kcal</span></div>
        <div class="nutrition-item"><span class="nutrition-label">平均タンパク質</span><span>${Math.round((totals.protein / count) * 10) / 10}g</span></div>
        <div class="nutrition-item"><span class="nutrition-label">平均脂質</span><span>${Math.round((totals.fat / count) * 10) / 10}g</span></div>
        <div class="nutrition-item"><span class="nutrition-label">平均炭水化物</span><span>${Math.round((totals.carb / count) * 10) / 10}g</span></div>
      </div>
      <p class="analysis-note">集計対象: ${count}回分の調理記録</p>
    `;
  },
};
