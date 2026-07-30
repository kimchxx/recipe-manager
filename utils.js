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
  calcBudgetStats(yearMonth) {
    const purchases = Storage.getPurchases().filter((p) => p.date && p.date.startsWith(yearMonth));
    const selfTotal = purchases.filter((p) => p.type !== "eatout").reduce((s, p) => s + (p.price || 0), 0);
    const eatoutTotal = purchases.filter((p) => p.type === "eatout").reduce((s, p) => s + (p.price || 0), 0);
    const used = selfTotal + eatoutTotal;

    const budgetEntry = Storage.getBudgetForMonth(yearMonth);
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
      yearMonth, budget, used, selfTotal, eatoutTotal,
      remaining, usageRate, dailyAvg: Math.round(dailyAvg), projectedTotal, remainingPerDay,
      eatoutRatio, selfRatio, daysInMonth, elapsedDays, remainingDays,
    };
  },

  _isPastMonth(yearMonth) {
    return yearMonth < this.todayISO().slice(0, 7);
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
