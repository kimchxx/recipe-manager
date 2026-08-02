/**
 * analysis.js
 * ---------------------------------------------------------
 * 🍽食事管理画面のロジック（下部ナビの「食事管理」タブ）。
 * ・年月切替（この画面独自に表示中の年月を持つ）
 * ・今月の食費概況（食費ベース）
 * ・調理履歴ベースの1日平均・残り予算
 * ・食費ベースの1日平均・残り予算
 * ・グラフ①：自炊・外食の金額/割合
 * ・グラフ②：自炊/お菓子/ジュース/外食(一人)/外食(複数) の金額/割合
 * ・月別食費推移（購入金額ベース）・食材カテゴリ別支出・栄養分析
 * ---------------------------------------------------------
 */

const Analysis = {
  render() {
    if (!this._yearMonth) this._yearMonth = Utils.todayISO().slice(0, 7);
    const container = document.getElementById("page-content");
    container.innerHTML = `
      <div class="page-header">
        <h2>🍽 食事管理</h2>
      </div>
      ${Utils.monthSwitcherHtml(this._yearMonth, "Analysis.changeMonth")}

      <h3 class="section-title" style="margin-top:0;">🎯 栄養目標の達成度</h3>
      <div class="card" id="analysis-nutrition-goal"></div>

      <h3 class="section-title">今月の食費概況</h3>
      <div class="card" id="analysis-overview"></div>

      <h3 class="section-title">食事履歴ベース</h3>
      <div class="card" id="analysis-cooked-cost"></div>

      <h3 class="section-title">食費ベース</h3>
      <div class="card" id="analysis-budget"></div>

      <h3 class="section-title">グラフ：自炊・外食</h3>
      <div class="card" id="analysis-graph1"></div>

      <h3 class="section-title">グラフ：食費区分別の内訳</h3>
      <div class="card" id="analysis-graph2"></div>

      <h3 class="section-title">月別食費の推移（購入金額ベース・直近6ヶ月）</h3>
      <div class="card" id="analysis-monthly"></div>

      <h3 class="section-title">食材カテゴリ別支出</h3>
      <div class="card" id="analysis-category"></div>

      <h3 class="section-title">栄養分析（1食あたりの平均）</h3>
      <div class="card" id="analysis-nutrition"></div>
    `;
    this.renderNutritionGoal();
    this.renderOverview();
    this.renderCookedCost();
    this.renderBudget();
    this.renderGraph1();
    this.renderGraph2();
    this.renderMonthly();
    this.renderCategory();
    this.renderNutrition();
  },

  // ------------------------------------------------------
  // 栄養目標の達成度（本日1日の実摂取量 vs 目標値）
  // ------------------------------------------------------
  renderNutritionGoal() {
    const today = Utils.todayISO();
    const progress = Utils.calcNutritionProgress(today);
    const el = document.getElementById("analysis-nutrition-goal");
    const { totals, target } = progress;

    const items = [
      { key: "kcal", label: "カロリー", unit: "kcal" },
      { key: "protein", label: "タンパク質", unit: "g" },
      { key: "fat", label: "脂質", unit: "g" },
      { key: "carb", label: "炭水化物", unit: "g" },
    ];

    if (progress.entryCount === 0) {
      el.innerHTML = `
        <p class="empty-message-sm">本日（${Utils.formatDate(today)}）の食事記録がまだありません。レシピの「通常作成」や🍽食費登録の外食/その他、食事履歴の手動追加で記録すると、ここに本日の摂取量が表示されます。</p>
        <button class="btn btn-outline btn-block" style="margin-top:10px;" onclick="Analysis.openNutritionTargetModal()">🎯 目標値を設定</button>
      `;
      return;
    }

    const rows = items.map((item) => {
      const value = Math.round(totals[item.key] * 10) / 10;
      const goal = target[item.key] || 0;
      const pct = goal > 0 ? Math.round((value / goal) * 100) : 0;
      const over = pct > 110; // 目標を大きく超えている場合は注意表示
      const diff = Math.round((goal - value) * 10) / 10;
      const remainingText = goal <= 0
        ? ""
        : diff > 0
          ? `<span class="nutrition-goal-remaining">あと ${diff}${item.unit}</span>`
          : diff < 0
            ? `<span class="nutrition-goal-remaining over-budget">目標を ${Math.abs(diff)}${item.unit} 超過</span>`
            : `<span class="nutrition-goal-remaining">目標達成ちょうど</span>`;
      return `
        <div class="nutrition-goal-row">
          <div class="nutrition-goal-row-header">
            <span>${item.label}</span>
            <span class="${over ? "over-budget" : ""}">${value}${item.unit} / ${goal}${item.unit}</span>
          </div>
          <div class="bar-track budget-bar-track">
            <div class="bar-fill ${over ? "bar-fill-over" : ""}" style="width:${Math.min(Math.max(pct, 0), 100)}%"></div>
          </div>
          <div class="analysis-row-values"><span>達成率 ${goal > 0 ? pct : "-"}%</span>${remainingText}</div>
        </div>
      `;
    }).join("");

    el.innerHTML = `
      ${rows}
      <p class="analysis-note">本日（${Utils.formatDate(today)}）に記録された食事の合計と、目標値の比較です。</p>
      <button class="btn btn-outline btn-block" style="margin-top:6px;" onclick="Analysis.openNutritionTargetModal()">🎯 目標値を設定</button>
    `;
  },

  openNutritionTargetModal() {
    const target = Storage.getNutritionTarget();
    const body = `
      <div class="form-group">
        <label>1日の目標カロリー (kcal)</label>
        <input type="number" id="nt-kcal" class="input" value="${target.kcal}">
      </div>
      <div class="form-group">
        <label>1日の目標タンパク質 (g)</label>
        <input type="number" id="nt-protein" class="input" value="${target.protein}">
      </div>
      <div class="form-group">
        <label>1日の目標脂質 (g)</label>
        <input type="number" id="nt-fat" class="input" value="${target.fat}">
      </div>
      <div class="form-group">
        <label>1日の目標炭水化物 (g)</label>
        <input type="number" id="nt-carb" class="input" value="${target.carb}">
      </div>
    `;
    Modal.open("栄養目標を設定", body, [
      { label: "キャンセル", class: "btn-outline", onClick: () => Modal.close() },
      { label: "保存する", class: "btn-primary", onClick: () => Analysis.saveNutritionTarget() },
    ]);
  },

  saveNutritionTarget() {
    const target = {
      kcal: Number(document.getElementById("nt-kcal").value) || 0,
      protein: Number(document.getElementById("nt-protein").value) || 0,
      fat: Number(document.getElementById("nt-fat").value) || 0,
      carb: Number(document.getElementById("nt-carb").value) || 0,
    };
    Storage.setNutritionTarget(target);
    Modal.close();
    Toast.show("栄養目標を保存しました");
    this.renderNutritionGoal();
  },

  changeMonth(delta) {
    this._yearMonth = Utils.shiftYearMonth(this._yearMonth, delta);
    this.render();
  },

  // ------------------------------------------------------
  // 今月の食費概況（今月食費・残り予算・食費使用率）
  // ------------------------------------------------------
  renderOverview() {
    const stats = Utils.calcBudgetStats(this._yearMonth);
    const el = document.getElementById("analysis-overview");
    if (stats.budget === null) {
      el.innerHTML = `
        <div class="budget-detail-grid">
          <div class="budget-detail-item"><span class="nutrition-label">今月の食費</span><span>${Utils.formatYen(stats.used)}</span></div>
        </div>
        <p class="empty-message-sm" style="margin-top:10px;">食費予算が未設定です。💰家計管理の「カテゴリ別予算」で「食費」を設定すると、残り予算・使用率が表示されます。</p>
      `;
      return;
    }
    const overBudget = stats.usageRate > 100;
    el.innerHTML = `
      <div class="budget-detail-grid">
        <div class="budget-detail-item"><span class="nutrition-label">今月の食費</span><span>${Utils.formatYen(stats.used)}</span></div>
        <div class="budget-detail-item"><span class="nutrition-label">残り予算</span><span class="${overBudget ? "over-budget" : ""}">${Utils.formatYen(stats.remaining)}</span></div>
        <div class="budget-detail-item"><span class="nutrition-label">食費使用率</span><span>${Utils.formatPercent(stats.usageRate)}</span></div>
      </div>
      <div class="bar-track budget-bar-track" style="margin-top:10px;">
        <div class="bar-fill ${overBudget ? "bar-fill-over" : ""}" style="width:${Math.min(Math.max(stats.usageRate, 0), 100)}%"></div>
      </div>
    `;
  },

  // ------------------------------------------------------
  // 調理履歴ベース（1日平均材料費・残り予算・残り1日使用可能額）
  // ------------------------------------------------------
  renderCookedCost() {
    const stats = Utils.calcDailyCookedCostStats(this._yearMonth);
    const el = document.getElementById("analysis-cooked-cost");

    if (stats.entryCount === 0) {
      el.innerHTML = `<p class="empty-message">この月の調理履歴がまだありません。レシピ画面の「通常作成」「材料変更して作成」、または調理履歴画面の「手動追加」で記録されます。</p>`;
      return;
    }

    el.innerHTML = `
      <div class="budget-detail-grid">
        <div class="budget-detail-item"><span class="nutrition-label">1日あたりの平均材料費</span><span>${Utils.formatYen(stats.dailyAvg)}</span></div>
        <div class="budget-detail-item"><span class="nutrition-label">残り予算</span><span>${stats.remaining !== null ? Utils.formatYen(stats.remaining) : "-"}</span></div>
        <div class="budget-detail-item"><span class="nutrition-label">残り1日あたり使用可能額</span><span>${stats.remainingPerDay !== null ? Utils.formatYen(stats.remainingPerDay) : "-"}</span></div>
        <div class="budget-detail-item"><span class="nutrition-label">月間累計</span><span>${Utils.formatYen(stats.total)}</span></div>
      </div>
      <p class="analysis-note">購入金額（何を買ったか）ではなく、調理履歴（何を作った・食べたか）をもとにした食費です。</p>
    `;
  },

  // ------------------------------------------------------
  // 食費ベース（1日平均食費・残り予算・残り1日使用可能額。購入履歴ベース）
  // ------------------------------------------------------
  renderBudget() {
    const stats = Utils.calcBudgetStats(this._yearMonth);
    const el = document.getElementById("analysis-budget");

    if (stats.budget === null) {
      el.innerHTML = `<p class="empty-message">今月（${this._yearMonth}）の食費予算が未設定です。💰家計管理の「カテゴリ別予算」で「食費」を設定すると、ここに自動反映されます。</p>
        <button class="btn btn-outline btn-block" style="margin-top:10px;" onclick="App.navigate('monthlyreport')">💰 家計管理でカテゴリ別予算を設定する</button>`;
      return;
    }

    el.innerHTML = `
      <div class="budget-detail-grid">
        <div class="budget-detail-item"><span class="nutrition-label">1日あたりの平均食費</span><span>${Utils.formatYen(stats.dailyAvg)}</span></div>
        <div class="budget-detail-item"><span class="nutrition-label">残り予算</span><span>${Utils.formatYen(stats.remaining)}</span></div>
        <div class="budget-detail-item"><span class="nutrition-label">残り1日あたり使用可能額</span><span>${stats.remainingPerDay !== null ? Utils.formatYen(stats.remainingPerDay) : "-"}</span></div>
        <div class="budget-detail-item"><span class="nutrition-label">月末予想金額</span><span>${Utils.formatYen(stats.projectedTotal)}</span></div>
      </div>
      <p class="settings-note" style="margin-top:10px;">食費予算は💰家計管理の「カテゴリ別予算」の「食費」と共通です（自動反映・個別設定不要）。</p>
    `;
  },

  // ------------------------------------------------------
  // グラフ①：自炊・外食（金額・割合）。📋食事履歴ベース（購入履歴ではない）
  // ------------------------------------------------------
  renderGraph1() {
    const food = Utils.calcMealCategoryBreakdown(this._yearMonth);
    const el = document.getElementById("analysis-graph1");
    const total = food.selfTotal + food.eatoutTotal;
    if (food.entryCount === 0) {
      el.innerHTML = `<p class="empty-message">この月の食事履歴がまだありません。レシピの「通常作成」や🍽食費登録の外食/その他で記録すると、ここに反映されます。</p>`;
      return;
    }
    el.innerHTML = Utils.buildDonutChartHtml(
      { "自炊": food.selfTotal, "外食": food.eatoutTotal },
      total,
      "自炊・外食"
    ) + `<p class="analysis-note">📋食事履歴（何を作った・食べたか）を元にした集計です。購入金額とは別の集計です。</p>`;
  },

  // ------------------------------------------------------
  // グラフ②：自炊/お菓子/ジュース/外食(一人)/外食(複数)（金額・割合）。📋食事履歴ベース
  // ------------------------------------------------------
  renderGraph2() {
    const food = Utils.calcMealCategoryBreakdown(this._yearMonth);
    const el = document.getElementById("analysis-graph2");
    if (food.entryCount === 0) {
      el.innerHTML = `<p class="empty-message">この月の食事履歴がまだありません。</p>`;
      return;
    }
    el.innerHTML = Utils.buildDonutChartHtml(food.breakdown, food.total, "食費内訳")
      + `<p class="analysis-note">📋食事履歴（何を作った・食べたか）を元にした集計です。購入金額とは別の集計です。</p>`;
  },

  // ------------------------------------------------------
  // 月別食費の推移（購入金額ベース。直近6ヶ月）
  // 「食材購入・外食・お菓子/ジュース」すべて含めた、買い物のタイミングで
  // 変動する“実際の支払いベース”の推移。1日あたりの平均は「食費ベース」
  // セクションを参照。
  // ------------------------------------------------------
  renderMonthly() {
    const el = document.getElementById("analysis-monthly");
    const months = Utils.getTrailingMonths(this._yearMonth, 6);
    const rows = months.map((m) => {
      const purchases = Storage.getPurchases().filter((p) => p.date && p.date.startsWith(m));
      const total = purchases.reduce((s, p) => s + (p.price || 0), 0);
      const count = purchases.length;
      return { month: m, total, count };
    });

    const hasData = rows.some((r) => r.count > 0);
    if (!hasData) {
      el.innerHTML = `<p class="empty-message">この期間の購入履歴がありません。</p>`;
      return;
    }

    const labels = months.map((m) => `${Number(m.split("-")[1])}月`);
    const chart = Utils.buildLineChartHtml(labels, [
      { name: "食費", color: "#6E8C5C", values: rows.map((r) => r.total) },
    ]);

    el.innerHTML = `
      ${chart}
      <p class="analysis-note">食材購入・外食・お菓子/ジュースの支払いを合計した、月ごとの食費の推移です（買い物のタイミングによって月ごとの金額は変動します）。</p>
    `;
  },

  renderCategory() {
    const purchases = Storage.getPurchases().filter((p) => p.type === "self" && p.date && p.date.startsWith(this._yearMonth));
    const el = document.getElementById("analysis-category");

    const groups = {};
    purchases.forEach((p) => {
      const cat = Utils.getIngredientCategory(p.name);
      groups[cat] = (groups[cat] || 0) + (p.price || 0);
    });
    const total = Object.values(groups).reduce((s, v) => s + v, 0);

    el.innerHTML = Utils.buildDonutChartHtml(groups, total, "食材カテゴリ");
  },

  renderNutrition() {
    const history = Storage.getCookedHistory().filter((h) => h.date && h.date.startsWith(this._yearMonth));
    const el = document.getElementById("analysis-nutrition");
    if (history.length === 0) {
      el.innerHTML = `<p class="empty-message">この月の食事履歴がまだありません。レシピの「通常作成」、🍽食費登録の外食/その他、食事履歴の手動追加で記録されます。</p>`;
      return;
    }

    const totals = { kcal: 0, protein: 0, fat: 0, carb: 0 };
    history.forEach((h) => {
      const n = Utils.getMealNutrition(h);
      totals.kcal += n.kcal;
      totals.protein += n.protein;
      totals.fat += n.fat;
      totals.carb += n.carb;
    });
    const count = history.length;

    el.innerHTML = `
      <div class="nutrition-grid">
        <div class="nutrition-item"><span class="nutrition-label">平均カロリー</span><span>${Math.round(totals.kcal / count)}kcal</span></div>
        <div class="nutrition-item"><span class="nutrition-label">平均タンパク質</span><span>${Math.round((totals.protein / count) * 10) / 10}g</span></div>
        <div class="nutrition-item"><span class="nutrition-label">平均脂質</span><span>${Math.round((totals.fat / count) * 10) / 10}g</span></div>
        <div class="nutrition-item"><span class="nutrition-label">平均炭水化物</span><span>${Math.round((totals.carb / count) * 10) / 10}g</span></div>
      </div>
      <p class="analysis-note">集計対象: ${count}件の食事記録（自炊・外食・お菓子・ジュース含む）</p>
    `;
  },
};
