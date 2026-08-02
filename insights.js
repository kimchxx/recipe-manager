/**
 * insights.js
 * ---------------------------------------------------------
 * 📊分析タブ（詳細分析画面）。家計管理・食事管理より詳細な、
 * 複数月にまたがる推移・ランキング・レポートを扱う。
 * ---------------------------------------------------------
 */

const Insights = {
  TREND_MONTHS: 6, // 推移グラフで遡る月数

  render() {
    if (!this._yearMonth) this._yearMonth = Utils.todayISO().slice(0, 7);
    const container = document.getElementById("page-content");
    container.innerHTML = `
      <div class="page-header">
        <h2>📊 分析</h2>
      </div>
      ${Utils.monthSwitcherHtml(this._yearMonth, "Insights.changeMonth")}

      <h3 class="section-title" style="margin-top:0;">レポート</h3>
      <div class="card" id="ins-report"></div>

      <h3 class="section-title">月別・年間収支</h3>
      <div class="card" id="ins-yearly"></div>

      <h3 class="section-title">前月比較</h3>
      <div class="card" id="ins-compare"></div>

      <h3 class="section-title">固定費・変動費の推移</h3>
      <div class="card" id="ins-fixed-variable"></div>

      <h3 class="section-title">カテゴリ別推移</h3>
      <div class="card" id="ins-category-trend"></div>

      <h3 class="section-title">食費の推移</h3>
      <div class="card" id="ins-food-trend"></div>

      <h3 class="section-title">自炊率・外食率の推移</h3>
      <div class="card" id="ins-ratio-trend"></div>

      <h3 class="section-title">栄養の推移</h3>
      <div class="card" id="ins-nutrition-trend"></div>

      <h3 class="section-title">ランキング</h3>
      <div class="card" id="ins-ranking"></div>

      <h3 class="section-title">月平均・年平均</h3>
      <div class="card" id="ins-average"></div>
    `;
    this.renderReport();
    this.renderYearly();
    this.renderCompare();
    this.renderFixedVariableTrend();
    this.renderCategoryTrend();
    this.renderFoodTrend();
    this.renderRatioTrend();
    this.renderNutritionTrend();
    this.renderRanking();
    this.renderAverage();
  },

  changeMonth(delta) {
    this._yearMonth = Utils.shiftYearMonth(this._yearMonth, delta);
    this.render();
  },

  // ------------------------------------------------------
  // レポート（簡易な自動要約文）
  // ------------------------------------------------------
  renderReport() {
    const f = Utils.calcMonthlyFinance(this._yearMonth);
    const prev = Utils.calcMonthlyFinance(Utils.getPrevYearMonth(this._yearMonth));
    const el = document.getElementById("ins-report");

    const diff = f.totalExpense - prev.totalExpense;
    const diffText = diff === 0 ? "先月と同額でした。" : (diff > 0 ? `先月より${Utils.formatYen(diff)}多く使いました。` : `先月より${Utils.formatYen(Math.abs(diff))}少なく済みました。`);
    const balanceText = f.balance >= 0 ? `収支は${Utils.formatYen(f.balance)}の黒字です。` : `収支は${Utils.formatYen(Math.abs(f.balance))}の赤字です。`;
    const foodText = f.totalExpense > 0 ? `支出全体のうち食費が${Utils.formatPercent(f.foodRatio)}を占めています。` : "";

    el.innerHTML = `
      <p class="analysis-note" style="font-size:14px; line-height:1.9;">
        ${Utils.formatYearMonthLabel(this._yearMonth)}の支出合計は${Utils.formatYen(f.totalExpense)}でした。${diffText}${balanceText}${foodText}
      </p>
    `;
  },

  // ------------------------------------------------------
  // 月別・年間収支
  // ------------------------------------------------------
  renderYearly() {
    const el = document.getElementById("ins-yearly");
    const months = Utils.getTrailingMonths(this._yearMonth, this.TREND_MONTHS);
    const rows = months.map((m) => {
      const f = Utils.calcMonthlyFinance(m);
      return { month: m, income: f.incomeTotal, expense: f.totalExpense, balance: f.balance };
    });

    const yearPrefix = this._yearMonth.slice(0, 4);
    const yearMonths = [];
    for (let mo = 1; mo <= 12; mo++) {
      const ym = `${yearPrefix}-${String(mo).padStart(2, "0")}`;
      if (ym <= this._yearMonth) yearMonths.push(ym);
    }
    const yearIncome = yearMonths.reduce((s, m) => s + Utils.calcMonthlyFinance(m).incomeTotal, 0);
    const yearExpense = yearMonths.reduce((s, m) => s + Utils.calcMonthlyFinance(m).totalExpense, 0);

    const labels = months.map((m) => `${Number(m.split("-")[1])}月`);
    const chart = Utils.buildLineChartHtml(labels, [
      { name: "収入", color: "#6E8C5C", values: rows.map((r) => r.income) },
      { name: "支出", color: "#B25D45", values: rows.map((r) => r.expense) },
    ]);

    el.innerHTML = `
      <div class="budget-detail-grid" style="margin-bottom:14px;">
        <div class="budget-detail-item"><span class="nutrition-label">${yearPrefix}年 収入累計</span><span>${Utils.formatYen(yearIncome)}</span></div>
        <div class="budget-detail-item"><span class="nutrition-label">${yearPrefix}年 支出累計</span><span>${Utils.formatYen(yearExpense)}</span></div>
      </div>
      ${chart}
    `;
  },

  // ------------------------------------------------------
  // 前月比較
  // ------------------------------------------------------
  renderCompare() {
    const current = Utils.calcMonthlyFinance(this._yearMonth);
    const prevYearMonth = Utils.getPrevYearMonth(this._yearMonth);
    const prev = Utils.calcMonthlyFinance(prevYearMonth);
    const diff = current.totalExpense - prev.totalExpense;
    const diffPct = prev.totalExpense > 0 ? Math.round((diff / prev.totalExpense) * 1000) / 10 : null;
    const increased = diff > 0;

    const el = document.getElementById("ins-compare");
    el.innerHTML = `
      <div class="budget-detail-grid">
        <div class="budget-detail-item"><span class="nutrition-label">${Utils.formatYearMonthLabel(prevYearMonth)}</span><span>${Utils.formatYen(prev.totalExpense)}</span></div>
        <div class="budget-detail-item"><span class="nutrition-label">${Utils.formatYearMonthLabel(this._yearMonth)}</span><span>${Utils.formatYen(current.totalExpense)}</span></div>
      </div>
      <p class="analysis-note">
        前月比：<span class="${increased ? "over-budget" : ""}">${increased ? "+" : ""}${Utils.formatYen(diff)}</span>
        ${diffPct !== null ? `（${increased ? "+" : ""}${diffPct}%）` : ""}
        ${increased ? " 増加しています" : " 減少しています"}
      </p>
    `;
  },

  // ------------------------------------------------------
  // 固定費・変動費の推移
  // ------------------------------------------------------
  renderFixedVariableTrend() {
    const el = document.getElementById("ins-fixed-variable");
    const months = Utils.getTrailingMonths(this._yearMonth, this.TREND_MONTHS);
    const rows = months.map((m) => {
      const f = Utils.calcMonthlyFinance(m);
      return { month: m, fixed: f.fixedTotal, variable: f.variableTotal };
    });
    const labels = months.map((m) => `${Number(m.split("-")[1])}月`);
    el.innerHTML = Utils.buildLineChartHtml(labels, [
      { name: "固定費", color: "#7C97A3", values: rows.map((r) => r.fixed) },
      { name: "変動費", color: "#BFA13B", values: rows.map((r) => r.variable) },
    ]);
  },

  // ------------------------------------------------------
  // カテゴリ別推移（直近6ヶ月・上位5カテゴリ）
  // ------------------------------------------------------
  renderCategoryTrend() {
    const el = document.getElementById("ins-category-trend");
    const months = Utils.getTrailingMonths(this._yearMonth, this.TREND_MONTHS);
    const financeByMonth = months.map((m) => Utils.calcMonthlyFinance(m));

    const totals = {};
    financeByMonth.forEach((f) => {
      Object.entries(f.byCategory).forEach(([cat, amount]) => {
        totals[cat] = (totals[cat] || 0) + amount;
      });
    });
    const topCategories = Object.keys(totals).filter((c) => totals[c] > 0).sort((a, b) => totals[b] - totals[a]).slice(0, 5);

    if (topCategories.length === 0) {
      el.innerHTML = `<p class="empty-message">この期間の支出データがまだありません。</p>`;
      return;
    }

    const labels = months.map((m) => `${Number(m.split("-")[1])}月`);
    const series = topCategories.map((cat, idx) => ({
      name: cat,
      color: Utils.EXPENSE_CHART_COLORS[idx % Utils.EXPENSE_CHART_COLORS.length],
      values: financeByMonth.map((f) => f.byCategory[cat] || 0),
    }));
    el.innerHTML = Utils.buildLineChartHtml(labels, series) + `<p class="analysis-note">支出額が多い上位5カテゴリの推移です。</p>`;
  },

  // ------------------------------------------------------
  // 食費の推移
  // ------------------------------------------------------
  renderFoodTrend() {
    const el = document.getElementById("ins-food-trend");
    const months = Utils.getTrailingMonths(this._yearMonth, this.TREND_MONTHS);
    const rows = months.map((m) => ({ month: m, total: Utils.calcFoodTypeBreakdown(m).total }));
    const labels = months.map((m) => `${Number(m.split("-")[1])}月`);
    el.innerHTML = Utils.buildLineChartHtml(labels, [
      { name: "食費", color: "#6E8C5C", values: rows.map((r) => r.total) },
    ]);
  },

  // ------------------------------------------------------
  // 自炊率・外食率の推移
  // ------------------------------------------------------
  renderRatioTrend() {
    const el = document.getElementById("ins-ratio-trend");
    const months = Utils.getTrailingMonths(this._yearMonth, this.TREND_MONTHS);
    const rows = months.map((m) => {
      const food = Utils.calcMealCategoryBreakdown(m);
      const total = food.selfTotal + food.eatoutTotal;
      const selfRatio = total > 0 ? Math.round((food.selfTotal / total) * 1000) / 10 : 0;
      const eatoutRatio = total > 0 ? Math.round((food.eatoutTotal / total) * 1000) / 10 : 0;
      return { month: m, selfRatio, eatoutRatio };
    });
    const labels = months.map((m) => `${Number(m.split("-")[1])}月`);
    el.innerHTML = Utils.buildLineChartHtml(labels, [
      { name: "自炊率", color: "#6E8C5C", values: rows.map((r) => r.selfRatio) },
      { name: "外食率", color: "#B25D45", values: rows.map((r) => r.eatoutRatio) },
    ]) + `<p class="analysis-note">縦軸は割合（%）です。</p>`;
  },

  // ------------------------------------------------------
  // 栄養の推移
  // ------------------------------------------------------
  renderNutritionTrend() {
    const el = document.getElementById("ins-nutrition-trend");
    const months = Utils.getTrailingMonths(this._yearMonth, this.TREND_MONTHS);
    const rows = months.map((m) => {
      const history = Storage.getCookedHistory().filter((h) => h.date && h.date.startsWith(m));
      if (history.length === 0) return { month: m, kcal: 0, protein: 0, fat: 0, carb: 0, hasData: false };
      const totals = { kcal: 0, protein: 0, fat: 0, carb: 0 };
      history.forEach((h) => {
        const n = Utils.getMealNutrition(h);
        totals.kcal += n.kcal; totals.protein += n.protein; totals.fat += n.fat; totals.carb += n.carb;
      });
      const count = history.length;
      return {
        month: m, hasData: true,
        kcal: Math.round(totals.kcal / count),
        protein: Math.round((totals.protein / count) * 10) / 10,
        fat: Math.round((totals.fat / count) * 10) / 10,
        carb: Math.round((totals.carb / count) * 10) / 10,
      };
    });

    if (!rows.some((r) => r.hasData)) {
      el.innerHTML = `<p class="empty-message">この期間の食事履歴がまだありません。</p>`;
      return;
    }

    const labels = months.map((m) => `${Number(m.split("-")[1])}月`);
    const chart = Utils.buildLineChartHtml(labels, [
      { name: "平均カロリー", color: "#BFA13B", values: rows.map((r) => r.kcal) },
    ]);

    el.innerHTML = `
      ${chart}
      <p class="analysis-note">1食あたりの平均カロリー(kcal)の推移です。タンパク質・脂質・炭水化物は下表を参照してください。</p>
      <div class="category-trend-table" style="margin-top:8px;">
        <div class="category-trend-row category-trend-header">
          <span></span>
          ${labels.map((l) => `<span>${l}</span>`).join("")}
        </div>
        <div class="category-trend-row"><span class="category-trend-name">P(g)</span>${rows.map((r) => `<span>${r.hasData ? r.protein : "-"}</span>`).join("")}</div>
        <div class="category-trend-row"><span class="category-trend-name">F(g)</span>${rows.map((r) => `<span>${r.hasData ? r.fat : "-"}</span>`).join("")}</div>
        <div class="category-trend-row"><span class="category-trend-name">C(g)</span>${rows.map((r) => `<span>${r.hasData ? r.carb : "-"}</span>`).join("")}</div>
      </div>
    `;
  },

  // ------------------------------------------------------
  // ランキング（カテゴリ支出・よく作った料理）
  // ------------------------------------------------------
  renderRanking() {
    const el = document.getElementById("ins-ranking");
    const f = Utils.calcMonthlyFinance(this._yearMonth);
    const catRanking = Object.entries(f.byCategory).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]).slice(0, 5);

    const history = Storage.getCookedHistory().filter((h) => h.date && h.date.startsWith(this._yearMonth));
    const nameCounts = {};
    history.forEach((h) => { nameCounts[h.name] = (nameCounts[h.name] || 0) + 1; });
    const recipeRanking = Object.entries(nameCounts).sort((a, b) => b[1] - a[1]).slice(0, 5);

    el.innerHTML = `
      <h4 class="section-title-sm" style="margin-top:0;">カテゴリ支出ランキング（${Utils.formatYearMonthLabel(this._yearMonth)}）</h4>
      ${catRanking.length === 0 ? `<p class="empty-message-sm">データがありません。</p>` : catRanking.map(([cat, amount], idx) => `
        <div class="ranking-row"><span class="ranking-num">${idx + 1}</span><span class="ranking-name">${Utils.esc(cat)}</span><span class="ranking-value">${Utils.formatYen(amount)}</span></div>
      `).join("")}

      <h4 class="section-title-sm">よく作った料理ランキング（${Utils.formatYearMonthLabel(this._yearMonth)}）</h4>
      ${recipeRanking.length === 0 ? `<p class="empty-message-sm">データがありません。</p>` : recipeRanking.map(([name, count], idx) => `
        <div class="ranking-row"><span class="ranking-num">${idx + 1}</span><span class="ranking-name">${Utils.esc(name)}</span><span class="ranking-value">${count}回</span></div>
      `).join("")}
    `;
  },

  // ------------------------------------------------------
  // 月平均・年平均
  // ------------------------------------------------------
  renderAverage() {
    const el = document.getElementById("ins-average");
    const months6 = Utils.getTrailingMonths(this._yearMonth, this.TREND_MONTHS);
    const monthlyTotals = months6.map((m) => Utils.calcMonthlyFinance(m).totalExpense);
    const monthAvg = Math.round(monthlyTotals.reduce((s, v) => s + v, 0) / months6.length);

    const yearPrefix = this._yearMonth.slice(0, 4);
    const yearMonthsSoFar = [];
    for (let mo = 1; mo <= 12; mo++) {
      const ym = `${yearPrefix}-${String(mo).padStart(2, "0")}`;
      if (ym <= this._yearMonth) yearMonthsSoFar.push(ym);
    }
    const yearTotal = yearMonthsSoFar.reduce((s, m) => s + Utils.calcMonthlyFinance(m).totalExpense, 0);
    const yearAvg = Math.round(yearTotal / yearMonthsSoFar.length);

    el.innerHTML = `
      <div class="budget-detail-grid">
        <div class="budget-detail-item"><span class="nutrition-label">直近${this.TREND_MONTHS}ヶ月の月平均支出</span><span>${Utils.formatYen(monthAvg)}</span></div>
        <div class="budget-detail-item"><span class="nutrition-label">${yearPrefix}年の月平均支出</span><span>${Utils.formatYen(yearAvg)}</span></div>
      </div>
    `;
  },
};
