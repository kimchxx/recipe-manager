/**
 * utils.js
 * ---------------------------------------------------------
 * 単位換算、材料費計算、栄養計算、表示用フォーマットなど
 * 複数の画面で共通して使うロジックをまとめたファイル。
 * ---------------------------------------------------------
 */

const Utils = {
  /** 今日の日付 (YYYY-MM-DD) */
  todayISO() {
    return new Date().toISOString().slice(0, 10);
  },

  /** 日付を "2026/7/29" 形式に整形 */
  formatDate(isoStr) {
    if (!isoStr) return "";
    const [y, m, d] = isoStr.split("-");
    return `${y}/${Number(m)}/${Number(d)}`;
  },

  // =========================================================
  // 年月切替（◀ 2026年8月 ▶）共通部品
  // ---------------------------------------------------------
  // 各画面（ホーム/家計管理/食事管理/分析）が、それぞれ独立して
  // 表示中の年月(_yearMonth)を持つ設計。この関数群はその共通処理。
  // =========================================================

  /** "2026-08" → "2026年8月" */
  formatYearMonthLabel(yearMonth) {
    const [y, m] = yearMonth.split("-");
    return `${y}年${Number(m)}月`;
  },

  /** "2026-08" を delta ヶ月分ずらす（-1で前月、+1で翌月） */
  shiftYearMonth(yearMonth, delta) {
    const [y, m] = yearMonth.split("-").map(Number);
    const d = new Date(y, m - 1 + delta, 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  },

  /** yearMonthを最終月として、直近n ヶ月分の "YYYY-MM" 配列を古い順で返す */
  getTrailingMonths(yearMonth, n) {
    const months = [];
    for (let i = n - 1; i >= 0; i--) {
      months.push(this.shiftYearMonth(yearMonth, -i));
    }
    return months;
  },

  /**
   * 年月切替バーのHTML断片を生成する。
   * onChangeHandler には、切替後に呼び出す（グローバルに参照可能な）
   * 関数名の文字列を渡す（例: "Home.changeMonth"）。
   */
  monthSwitcherHtml(yearMonth, onChangeHandler) {
    return `
      <div class="month-switcher">
        <button class="month-switcher-btn" onclick="${onChangeHandler}(-1)">◀</button>
        <span class="month-switcher-label">${this.formatYearMonthLabel(yearMonth)}</span>
        <button class="month-switcher-btn" onclick="${onChangeHandler}(1)">▶</button>
      </div>
    `;
  },

  /** 金額を "1,980円" 形式に整形。null/undefined は "-" */
  formatYen(num) {
    if (num === null || num === undefined || isNaN(num)) return "-";
    return Math.round(num).toLocaleString() + "円";
  },

  /**
   * 数量+単位を自然な表記にする
   * 例: formatQuantity(3, "大さじ") -> "大さじ3"
   *     formatQuantity(150, "g") -> "150g"
   *     formatQuantity(0.5, "L") -> "0.5L"
   */
  formatQuantity(quantity, unit) {
    const q = this.trimNumber(quantity);
    if (unit === "大さじ" || unit === "小さじ") {
      return `${unit}${q}`;
    }
    if (unit === "少々" || unit === "適量") {
      return unit;
    }
    return `${q}${unit}`;
  },

  /** 小数の末尾の0を削る (例: 1.50 -> 1.5, 2.00 -> 2) */
  trimNumber(num) {
    return Math.round(num * 100) / 100;
  },

  /** 評価(0.5刻み, 最大5)を★☆表記に変換 */
  formatRating(rating) {
    const full = Math.floor(rating);
    const half = rating - full >= 0.5;
    let stars = "★".repeat(full);
    if (half) stars += "☆彡"; // 半星は下の formatRatingHtml で表現するため簡易表記
    const empty = 5 - full - (half ? 1 : 0);
    stars += "☆".repeat(Math.max(empty, 0));
    return stars;
  },

  /** 評価をHTML表示用に生成（テキストベース、CSSでの装飾なしでも視認可能） */
  ratingStarsHtml(rating) {
    const full = Math.floor(rating);
    const half = rating - full >= 0.5;
    const empty = 5 - full - (half ? 1 : 0);
    let html = "";
    for (let i = 0; i < full; i++) html += '<span class="star star-full">★</span>';
    if (half) html += '<span class="star star-half">★</span>';
    for (let i = 0; i < empty; i++) html += '<span class="star star-empty">☆</span>';
    return html;
  },

  // =========================================================
  // 単位換算
  // =========================================================

  /** 単位が属するベースグループ（weight / volume / count_* / no_quantity）を返す */
  getBaseGroup(unit) {
    return UNIT_BASE_GROUP[unit] || null;
  },

  /** 2つの単位が自動換算可能かどうか（同じベースグループなら換算可） */
  isConvertible(unitA, unitB) {
    if (unitA === unitB) return true;
    const groupA = this.getBaseGroup(unitA);
    const groupB = this.getBaseGroup(unitB);
    if (!groupA || !groupB) return false;
    if (groupA === "no_quantity" || groupB === "no_quantity") return false;
    if (groupA.startsWith("count_") || groupB.startsWith("count_")) {
      // count系(個・匹・枚・本・合)は同一単位のみ換算可能（=isConvertibleにならないと上でreturn済み）
      return false;
    }
    return groupA === groupB;
  },

  /**
   * quantity(unit) を共通の基準単位(g または ml)に変換した値を返す。
   * count系・no_quantity系は変換せずそのまま返す(baseUnitは単位名そのもの)。
   */
  toBaseValue(quantity, unit) {
    const rate = UNIT_TO_BASE_RATE[unit] ?? 1;
    return quantity * rate;
  },

  /**
   * 換算可能な場合、quantity(fromUnit) を toUnit の数量に変換して返す。
   * 換算不可の場合は null を返す。
   */
  convertQuantity(quantity, fromUnit, toUnit) {
    if (fromUnit === toUnit) return quantity;
    if (!this.isConvertible(fromUnit, toUnit)) return null;
    const baseValue = this.toBaseValue(quantity, fromUnit);
    const toRate = UNIT_TO_BASE_RATE[toUnit] ?? 1;
    return baseValue / toRate;
  },

  // =========================================================
  // 材料費計算
  // =========================================================

  /**
   * 食材1個あたり(=recipeUnit基準)の材料費を計算する。
   * ・直近購入価格をもとに単価計算
   * ・購入履歴がない、または単位換算できない場合は null(="-"表示)
   *
   * @returns {number|null} 材料費(円)
   */
  calcMaterialCost(name, quantity, unit) {
    if (unit === "少々" || unit === "適量") return null;

    const purchase = Storage.getLatestPurchase(name);
    if (!purchase) return null;

    // 購入単位と同じ場合はそのまま比例計算
    if (purchase.unit === unit) {
      if (!purchase.quantity) return null;
      const unitPrice = purchase.price / purchase.quantity;
      return unitPrice * quantity;
    }

    // 換算可能な場合は変換してから計算
    const convertedQty = this.convertQuantity(quantity, unit, purchase.unit);
    if (convertedQty === null) return null;
    if (!purchase.quantity) return null;
    const unitPrice = purchase.price / purchase.quantity;
    return unitPrice * convertedQty;
  },

  /** レシピの材料費合計を計算（手動入力(manualCost)があればそちらを優先） */
  calcRecipeTotalCost(materials) {
    let total = 0;
    let hasValue = false;
    materials.forEach((m) => {
      const cost = m.manualCost !== null && m.manualCost !== undefined
        ? m.manualCost
        : this.calcMaterialCost(m.name, m.quantity, m.unit);
      if (cost !== null && cost !== undefined && !isNaN(cost)) {
        total += cost;
        hasValue = true;
      }
    });
    return hasValue ? Math.round(total) : null;
  },

  // =========================================================
  // 栄養計算
  // =========================================================

  /**
   * 材料1件分の栄養価を計算する。
   * 食材マスターに登録が無い場合は null を返す(=不明として合算しない)
   */
  calcMaterialNutrition(name, quantity, unit) {
    const master = Storage.findIngredientByName(name);
    if (!master) return null;
    if (unit === "少々" || unit === "適量") {
      return { kcal: 0, protein: 0, fat: 0, carb: 0 }; // 微量として0扱い
    }

    // nutritionPer=1 (個/匹単位あたり) の場合はそのまま quantity 倍
    // nutritionPer=100 (100g/100mlあたり) の場合は g/ml に換算してから計算
    let factor;
    if (master.nutritionPer === 1) {
      const converted = this.convertQuantity(quantity, unit, master.unit);
      factor = converted !== null ? converted : (unit === master.unit ? quantity : null);
    } else {
      const converted = this.convertQuantity(quantity, unit, master.unit === "kg" ? "kg" : "g");
      // master.unit が g/ml 系でなくても、標準単位への変換を試みる
      const baseQty = this.convertQuantity(quantity, unit, "g") ?? this.convertQuantity(quantity, unit, "ml");
      factor = baseQty !== null ? baseQty / master.nutritionPer : null;
    }
    if (factor === null) return null;

    return {
      kcal: master.kcal * factor,
      protein: master.protein * factor,
      fat: master.fat * factor,
      carb: master.carb * factor,
    };
  },

  /** レシピ全体の栄養価を集計（材料ごとに計算できないものはスキップ） */
  calcRecipeNutrition(materials) {
    const total = { kcal: 0, protein: 0, fat: 0, carb: 0 };
    materials.forEach((m) => {
      const n = this.calcMaterialNutrition(m.name, m.quantity, m.unit);
      if (n) {
        total.kcal += n.kcal;
        total.protein += n.protein;
        total.fat += n.fat;
        total.carb += n.carb;
      }
    });
    return {
      kcal: Math.round(total.kcal),
      protein: Math.round(total.protein * 10) / 10,
      fat: Math.round(total.fat * 10) / 10,
      carb: Math.round(total.carb * 10) / 10,
    };
  },

  /**
   * 食事履歴1件分の栄養価を取得する（統一ゲッター）。
   * 材料情報がある（自炊・レシピ経由）場合はそこから計算し、
   * 無い場合（外食・お菓子・ジュース・手動登録）は保存されている
   * kcal/protein/fat/carb の値をそのまま使う。
   */
  getMealNutrition(entry) {
    if (entry.materials && entry.materials.length > 0) {
      return this.calcRecipeNutrition(entry.materials);
    }
    return {
      kcal: Number(entry.kcal) || 0,
      protein: Number(entry.protein) || 0,
      fat: Number(entry.fat) || 0,
      carb: Number(entry.carb) || 0,
    };
  },

  /**
   * 指定日(YYYY-MM-DD。省略時は本日)の栄養価合計と目標値との比較。
   * 「1日あたりの平均」ではなく、その日1日に実際に食べた分の合計で判定する。
   */
  calcNutritionProgress(date) {
    const targetDate = date || this.todayISO();
    const history = Storage.getCookedHistory().filter((h) => h.date === targetDate);
    const totals = { kcal: 0, protein: 0, fat: 0, carb: 0 };
    history.forEach((h) => {
      const n = this.getMealNutrition(h);
      totals.kcal += n.kcal; totals.protein += n.protein; totals.fat += n.fat; totals.carb += n.carb;
    });

    const target = Storage.getNutritionTarget();
    return { date: targetDate, totals, target, entryCount: history.length };
  },

  /** 食材名を入力した際、食材マスターから標準単位を取得（見つからなければ null） */
  suggestUnit(name) {
    const master = Storage.findIngredientByName(name);
    return master ? master.unit : null;
  },

  /** 食材のカテゴリを取得（見つからなければ「その他」） */
  getIngredientCategory(name) {
    const master = Storage.findIngredientByName(name);
    return master ? master.category : "その他";
  },

  /** 一意なID生成 */
  uid(prefix) {
    return prefix + Date.now() + Math.floor(Math.random() * 1000);
  },

  // =========================================================
  // 食費予算・外食/自炊 集計
  // =========================================================

  /**
   * 指定年月(YYYY-MM)の食費予算・使用状況を集計する。
   * 予算未設定の場合は budget: null を返す（他の値は計算できる範囲で返す）。
   *
   * 残り日数は「当日を含めず、翌日から月末まで」を基準とする。
   * 0除算が起きないよう、日数が0になる箇所は null にフォールバックする。
   */
  /**
   * 指定年月(YYYY-MM)の食費を「自炊/外食(一人)/外食(複数)/お菓子/ジュース」の
   * 5区分で集計する。自炊・外食は購入履歴（🛒購入登録）、お菓子・ジュースは
   * 支出履歴（💴支出管理の専用エリア、カテゴリ=食費）から取得する。
   * 既存の食費予算（calcBudgetStats）・家計集計（calcMonthlyFinance）の両方が
   * この関数を土台にしている。
   */
  calcFoodTypeBreakdown(yearMonth) {
    const purchases = Storage.getPurchases().filter((p) => p.date && p.date.startsWith(yearMonth));
    const selfTotal = purchases.filter((p) => p.type === "self").reduce((s, p) => s + (p.price || 0), 0);
    const soloTotal = purchases.filter((p) => p.type === "eatout" && p.eatoutType !== "group").reduce((s, p) => s + (p.price || 0), 0);
    const groupTotal = purchases.filter((p) => p.type === "eatout" && p.eatoutType === "group").reduce((s, p) => s + (p.price || 0), 0);
    const snackTotal = purchases.filter((p) => p.type === "other" && p.otherFoodType !== "drink").reduce((s, p) => s + (p.price || 0), 0);
    const drinkTotal = purchases.filter((p) => p.type === "other" && p.otherFoodType === "drink").reduce((s, p) => s + (p.price || 0), 0);

    const eatoutTotal = soloTotal + groupTotal;
    const total = selfTotal + eatoutTotal + snackTotal + drinkTotal;

    return {
      yearMonth, total, selfTotal, soloTotal, groupTotal, eatoutTotal, snackTotal, drinkTotal,
      breakdown: {
        [FOOD_TYPE_SELF]: selfTotal,
        [FOOD_TYPE_EATOUT_SOLO]: soloTotal,
        [FOOD_TYPE_EATOUT_GROUP]: groupTotal,
        [FOOD_TYPE_SNACK]: snackTotal,
        [FOOD_TYPE_DRINK]: drinkTotal,
      },
    };
  },

  /**
   * 指定年月(YYYY-MM)の「自炊/外食(一人)/外食(複数)/お菓子/ジュース」を、
   * 購入金額ではなく📋食事履歴（実際に何を作った・食べたか）を元に集計する。
   * 「自炊率・外食率」「グラフ：自炊・外食」「グラフ：食費区分別の内訳」で使用。
   *
   * calcFoodTypeBreakdown()（購入履歴ベース・予算管理用）とは意図的に別関数にしている。
   * 例：今月新たに食材を買わず、在庫を使って自炊した場合でも、
   * 　　レシピの材料費は計算できるため、自炊の実績として正しく反映される。
   */
  calcMealCategoryBreakdown(yearMonth) {
    const history = Storage.getCookedHistory().filter((h) => h.date && h.date.startsWith(yearMonth));
    const totals = { self_recipe: 0, self_manual: 0, eatout_solo: 0, eatout_group: 0, snack: 0, drink: 0 };
    history.forEach((h) => {
      // mealCategory が無い古いデータは、レシピ紐付きなら自炊(レシピ)、それ以外は自炊(手動)とみなす
      const cat = h.mealCategory || (h.recipeId ? "self_recipe" : "self_manual");
      if (totals[cat] === undefined) return;
      totals[cat] += h.cost || 0;
    });

    const selfTotal = totals.self_recipe + totals.self_manual;
    const eatoutTotal = totals.eatout_solo + totals.eatout_group;
    const snackTotal = totals.snack;
    const drinkTotal = totals.drink;
    const total = selfTotal + eatoutTotal + snackTotal + drinkTotal;

    return {
      yearMonth, total, entryCount: history.length,
      selfTotal, soloTotal: totals.eatout_solo, groupTotal: totals.eatout_group, eatoutTotal, snackTotal, drinkTotal,
      breakdown: {
        [FOOD_TYPE_SELF]: selfTotal,
        [FOOD_TYPE_EATOUT_SOLO]: totals.eatout_solo,
        [FOOD_TYPE_EATOUT_GROUP]: totals.eatout_group,
        [FOOD_TYPE_SNACK]: snackTotal,
        [FOOD_TYPE_DRINK]: drinkTotal,
      },
    };
  },

  calcBudgetStats(yearMonth) {
    const food = this.calcFoodTypeBreakdown(yearMonth);
    const selfTotal = food.selfTotal;
    const eatoutTotal = food.eatoutTotal + food.snackTotal + food.drinkTotal; // 自炊以外(外食+お菓子+ジュース)をまとめて「外食等」として扱う
    const used = food.total;

    // 食費予算は「カテゴリ別予算」の「食費」カテゴリと共通化されている（二重設定不要・自動反映）
    const budgetEntry = Storage.getEffectiveCategoryBudget(yearMonth, "食費");
    const budget = budgetEntry ? budgetEntry.budget : null;

    const [y, m] = yearMonth.split("-").map(Number);
    const daysInMonth = new Date(y, m, 0).getDate();
    const isCurrentMonth = yearMonth === this.todayISO().slice(0, 7);
    const todayDate = new Date().getDate();

    // 経過日数：当月なら本日まで、過去月なら月全体、未来月なら0扱い
    const elapsedDays = isCurrentMonth ? todayDate : (this._isPastMonth(yearMonth) ? daysInMonth : 0);
    // 残り日数：翌日から月末まで（当日は含めない）。当月以外は0。
    const remainingDays = isCurrentMonth ? Math.max(daysInMonth - todayDate, 0) : 0;

    const dailyAvg = elapsedDays > 0 ? used / elapsedDays : 0;
    const projectedTotal = elapsedDays > 0 ? Math.round(dailyAvg * daysInMonth) : used;
    const remaining = budget !== null ? budget - used : null;
    const usageRate = budget ? Math.round((used / budget) * 1000) / 10 : null;
    const remainingPerDay = (remaining !== null && remainingDays > 0) ? Math.round(remaining / remainingDays) : null;

    const eatoutRatio = used > 0 ? Math.round((eatoutTotal / used) * 1000) / 10 : 0;
    const selfRatio = used > 0 ? Math.round((selfTotal / used) * 1000) / 10 : 0;

    return {
      yearMonth, budget, used, selfTotal, eatoutTotal, foodBreakdown: food,
      remaining, usageRate, dailyAvg: Math.round(dailyAvg), projectedTotal, remainingPerDay,
      eatoutRatio, selfRatio, daysInMonth, elapsedDays, remainingDays,
    };
  },

  _isPastMonth(yearMonth) {
    return yearMonth < this.todayISO().slice(0, 7);
  },

  /**
   * 指定年月(YYYY-MM)の「調理履歴ベース」の食費を集計する。
   * 購入金額（何を買ったか）ではなく、実際に作った/食べた料理の食費（何を食べたか）を
   * 日付ごとに合計し、その月の平均（1日あたり）を出す。
   * 経過日数の考え方は calcBudgetStats() と揃えている。
   */
  calcDailyCookedCostStats(yearMonth) {
    const history = Storage.getCookedHistory().filter((h) => h.date && h.date.startsWith(yearMonth));
    const total = history.reduce((s, h) => s + (h.cost || 0), 0);

    const [y, m] = yearMonth.split("-").map(Number);
    const daysInMonth = new Date(y, m, 0).getDate();
    const isCurrentMonth = yearMonth === this.todayISO().slice(0, 7);
    const todayDate = new Date().getDate();
    const elapsedDays = isCurrentMonth ? todayDate : (this._isPastMonth(yearMonth) ? daysInMonth : 0);
    const remainingDays = isCurrentMonth ? Math.max(daysInMonth - todayDate, 0) : 0;

    const dailyAvg = elapsedDays > 0 ? Math.round(total / elapsedDays) : 0;

    // 日付ごとの内訳（複数回作った日はまとめて合算）
    const byDate = {};
    history.forEach((h) => { byDate[h.date] = (byDate[h.date] || 0) + (h.cost || 0); });
    const cookedDayCount = Object.keys(byDate).length;

    // 食費予算（カテゴリ別予算の「食費」と共通）をもとにした残り予算・残り1日使用可能額
    const budgetEntry = Storage.getEffectiveCategoryBudget(yearMonth, "食費");
    const budget = budgetEntry ? budgetEntry.budget : null;
    const remaining = budget !== null ? budget - total : null;
    const remainingPerDay = (remaining !== null && remainingDays > 0) ? Math.round(remaining / remainingDays) : null;

    return {
      yearMonth, total, elapsedDays, remainingDays, dailyAvg, entryCount: history.length, cookedDayCount, byDate,
      budget, remaining, remainingPerDay,
    };
  },

  // =========================================================
  // お金管理機能（家計簿）の集計
  // ---------------------------------------------------------
  // 既存の食費予算（calcBudgetStats）とは独立した仕組み。
  // 「食費」「外食」は購入履歴から都度計算し、支出履歴（手入力）と
  // 合算してカテゴリ別の家計を出す。
  // =========================================================

  /** "YYYY-MM" の前月を "YYYY-MM" で返す */
  getPrevYearMonth(yearMonth) {
    const [y, m] = yearMonth.split("-").map(Number);
    const d = new Date(y, m - 2, 1); // m-2: JSのDateは0始まりなので前月を指す
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  },

  /**
   * 指定年月(YYYY-MM)の家計を集計する。
   * 支出はカテゴリ別に、購入履歴（自炊→食費／外食→外食）と
   * 支出履歴（それ以外の手入力分）を合算して算出する。
   */
  calcMonthlyFinance(yearMonth) {
    const categories = Storage.getExpenseCategories();
    const typeByCategory = {};
    categories.forEach((c) => { typeByCategory[c.name] = c.type; });

    const food = this.calcFoodTypeBreakdown(yearMonth);

    // 「食費」カテゴリの支出履歴（お菓子・ジュース）は food.total に含まれているため、
    // 通常の支出集計ループでは除外し、二重計上を防ぐ
    const expenses = Storage.getExpenses().filter((e) => e.date && e.date.startsWith(yearMonth) && e.category !== "食費");

    const byCategory = {};
    categories.forEach((c) => { byCategory[c.name] = 0; }); // 未使用のカテゴリも0円で一覧に出す
    byCategory["食費"] = food.total;
    expenses.forEach((e) => {
      byCategory[e.category] = (byCategory[e.category] || 0) + (e.amount || 0);
    });

    const totalExpense = Object.values(byCategory).reduce((s, v) => s + v, 0);

    let fixedTotal = 0;
    let variableTotal = 0;
    Object.keys(byCategory).forEach((cat) => {
      const type = typeByCategory[cat] || "変動費";
      if (type === "固定費") fixedTotal += byCategory[cat];
      else variableTotal += byCategory[cat];
    });

    const incomeTotal = Storage.getIncomes()
      .filter((i) => i.date && i.date.startsWith(yearMonth))
      .reduce((s, i) => s + (i.amount || 0), 0);

    const balance = incomeTotal - totalExpense;
    const foodRatio = totalExpense > 0 ? Math.round((byCategory["食費"] / totalExpense) * 1000) / 10 : 0;

    return {
      yearMonth, byCategory, totalExpense, fixedTotal, variableTotal, foodBreakdown: food,
      incomeTotal, balance, foodRatio, expenseCount: expenses.length,
    };
  },

  /**
   * カテゴリ別予算の使用状況（指定年月）。
   * その月に明示的な設定が無くても、過去に一度でも設定されたカテゴリは
   * 直近の設定額を自動的に引き継いで表示する（毎月設定し直す必要が無いようにするため）。
   */
  calcCategoryBudgetStats(yearMonth) {
    const finance = this.calcMonthlyFinance(yearMonth);
    const categories = Storage.getExpenseCategories();
    const results = [];
    categories.forEach((c) => {
      const effective = Storage.getEffectiveCategoryBudget(yearMonth, c.name);
      if (!effective || !effective.budget) return; // 一度も予算設定されていないカテゴリは対象外
      const used = finance.byCategory[c.name] || 0;
      const remaining = effective.budget - used;
      const rate = effective.budget > 0 ? Math.round((used / effective.budget) * 1000) / 10 : 0;
      results.push({
        category: c.name, budget: effective.budget, used, remaining, rate, over: used > effective.budget,
        isCarriedOver: effective.yearMonth !== yearMonth, // 今月の明示的な設定ではなく、過去月からの繰越であることの目印
      });
    });
    return results;
  },

  // 家計のカテゴリ別グラフで使う配色（アプリのカラーパレットに合わせた落ち着いた色味を巡回で使う）
  EXPENSE_CHART_COLORS: [
    "#6E8C5C", "#BFA13B", "#B25D45", "#7C97A3", "#9C7CB0",
    "#C08552", "#5E8C7C", "#A3785A", "#8B8CBF", "#B5A642",
  ],

  /**
   * カテゴリ別支出の内訳（{カテゴリ名: 金額}）から、
   * ドーナツグラフ＋凡例のHTMLを生成する共通関数。
   * home.js・monthlyreport.js の両方から利用する。
   */
  buildDonutChartHtml(byCategory, totalExpense, centerLabel = "支出合計") {
    const entries = Object.entries(byCategory).filter(([, amount]) => amount > 0).sort((a, b) => b[1] - a[1]);
    if (entries.length === 0 || totalExpense <= 0) {
      return `<p class="empty-message">支出データがまだありません。</p>`;
    }

    const colors = this.EXPENSE_CHART_COLORS;
    let cumulative = 0;
    const gradientParts = entries.map(([, amount], idx) => {
      const pct = (amount / totalExpense) * 100;
      const start = cumulative;
      cumulative += pct;
      return `${colors[idx % colors.length]} ${start}% ${cumulative}%`;
    });

    const legend = entries.map(([name, amount], idx) => {
      const pct = Math.round((amount / totalExpense) * 1000) / 10;
      return `
        <div class="expense-legend-row">
          <span class="expense-legend-dot" style="background:${colors[idx % colors.length]}"></span>
          <span class="expense-legend-name">${this.esc(name)}</span>
          <span class="expense-legend-amount">${this.formatYen(amount)}</span>
          <span class="expense-legend-pct">${pct}%</span>
        </div>
      `;
    }).join("");

    return `
      <div class="donut-chart-wrap">
        <div class="donut-chart" style="background: conic-gradient(${gradientParts.join(", ")});">
          <div class="donut-chart-hole">
            <span class="donut-chart-total-label">${this.esc(centerLabel)}</span>
            <span class="donut-chart-total-value">${this.formatYen(totalExpense)}</span>
          </div>
        </div>
      </div>
      <div class="expense-legend-list">${legend}</div>
    `;
  },

  /**
   * 軽量なSVG折れ線グラフを生成する共通関数（外部ライブラリ不使用）。
   * 時系列の「推移」を見せたいセクション全般（📊分析・🍽食事管理）で使用する。
   *
   * @param {string[]} labels - X軸のラベル（例: ["3月","4月",...]）
   * @param {{name:string, color:string, values:number[], formatter?:(v:number)=>string}[]} series
   * @param {object} opts - { height, valueSuffix }
   */
  buildLineChartHtml(labels, series, opts = {}) {
    const width = 320;
    const height = opts.height || 150;
    const padL = 34;
    const padR = 10;
    const padT = 14;
    const padB = 24;
    const chartW = width - padL - padR;
    const chartH = height - padT - padB;

    const allValues = series.flatMap((s) => s.values);
    if (allValues.length === 0 || labels.length === 0) {
      return `<p class="empty-message">この期間のデータがまだありません。</p>`;
    }
    let maxVal = Math.max(...allValues, 0);
    let minVal = Math.min(...allValues, 0);
    if (maxVal === minVal) maxVal = minVal + 1; // 全て同値の場合に0除算を防ぐ
    const range = maxVal - minVal;

    const n = labels.length;
    const xStep = n > 1 ? chartW / (n - 1) : 0;
    const xFor = (i) => padL + i * xStep;
    const yFor = (v) => padT + chartH - ((v - minVal) / range) * chartH;

    // 横方向の目盛線（上端・中央・下端の3本）
    const gridLines = [1, 0.5, 0].map((frac) => {
      const y = padT + chartH * (1 - frac);
      const val = Math.round(minVal + range * frac);
      return `
        <line x1="${padL}" y1="${y}" x2="${width - padR}" y2="${y}" stroke="var(--color-border)" stroke-width="1" />
        <text x="${padL - 5}" y="${y + 3}" text-anchor="end" font-size="8.5" fill="#8C8474">${val}</text>
      `;
    }).join("");

    const linesHtml = series.map((s) => {
      const points = s.values.map((v, i) => `${xFor(i)},${yFor(v)}`).join(" ");
      const dots = s.values.map((v, i) => `<circle cx="${xFor(i)}" cy="${yFor(v)}" r="3" fill="${s.color}" />`).join("");
      return `<polyline points="${points}" fill="none" stroke="${s.color}" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round" />${dots}`;
    }).join("");

    const xLabelsHtml = labels.map((l, i) => `<text x="${xFor(i)}" y="${height - 6}" text-anchor="middle" font-size="9" fill="#8C8474">${this.esc(l)}</text>`).join("");

    const legendHtml = series.length > 1 ? `
      <div class="line-chart-legend">
        ${series.map((s) => `<span class="line-chart-legend-item"><span class="line-chart-legend-dot" style="background:${s.color}"></span>${this.esc(s.name)}</span>`).join("")}
      </div>
    ` : "";

    return `
      <div class="line-chart-wrap">
        <svg viewBox="0 0 ${width} ${height}" class="line-chart-svg" preserveAspectRatio="xMidYMid meet">
          ${gridLines}
          ${linesHtml}
          ${xLabelsHtml}
        </svg>
      </div>
      ${legendHtml}
    `;
  },

  // =========================================================
  // 献立候補（ブックマーク）の並び替え
  // ---------------------------------------------------------
  // 拡張ポイント：並び順の種類を増やす場合は data.js の
  // MEAL_PLAN_SORT_OPTIONS にラベルを追加し、下の switch 文に
  // 対応するケースを追加する。
  // =========================================================
  sortMealPlanRecipes(recipes, sortKey = MEAL_PLAN_DEFAULT_SORT) {
    const list = recipes.slice();
    switch (sortKey) {
      case "addedDesc":
      default:
        list.sort((a, b) => (b.mealPlanAddedAt || 0) - (a.mealPlanAddedAt || 0));
        break;
    }
    return list;
  },

  /** 整数％表示用（小数第1位まで、末尾の.0は残す仕様） */
  formatPercent(num) {
    if (num === null || num === undefined || isNaN(num)) return "-";
    return `${num}%`;
  },

  /** HTMLエスケープ（XSS対策の簡易版） */
  esc(str) {
    if (str === null || str === undefined) return "";
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  },
};
