/**
 * data.js
 * ---------------------------------------------------------
 * アプリの初期データ（マスターデータ）を定義するファイル。
 * ・食材マスター
 * ・単位変換マスター
 * ・カテゴリマスター
 * ・ジャンル選択肢
 * ・サンプルレシピ（動作確認用）
 *
 * ここに定義したデータは、初回起動時のみ localStorage に
 * 書き込まれます（storage.js の initializeData() を参照）。
 * 2回目以降の起動では localStorage 側のデータが優先されます。
 *
 * フェーズ2で Google スプレッドシート連携を行う際は、
 * このファイルの代わりにスプレッドシートから取得したデータを
 * 使用するように storage.js を差し替える想定です。
 * ---------------------------------------------------------
 */

// ==========================================================
// カテゴリマスター
// ==========================================================
const INITIAL_CATEGORIES = [
  { categoryId: "C001", categoryName: "魚" },
  { categoryId: "C002", categoryName: "肉" },
  { categoryId: "C003", categoryName: "野菜" },
  { categoryId: "C004", categoryName: "調味料" },
  { categoryId: "C005", categoryName: "主食" },
  { categoryId: "C006", categoryName: "乳製品・卵" },
  { categoryId: "C007", categoryName: "その他" },
];

// ==========================================================
// 単位変換マスター
// unit（変換元） → toUnit（変換先） の換算値（rate）
// 例: 1kg = 1000g、大さじ1 = 15ml
// ※ 個・匹・枚・本・合・少々・適量 は換算不可（自分自身のみ）
// ==========================================================
const INITIAL_UNIT_CONVERSIONS = [
  { unit: "kg", toUnit: "g", rate: 1000 },
  { unit: "L", toUnit: "ml", rate: 1000 },
  { unit: "大さじ", toUnit: "ml", rate: 15 },
  { unit: "小さじ", toUnit: "ml", rate: 5 },
];

// 換算のベースグループ定義（utils.js の単位換算処理で使用）
// baseGroup: 同じ baseGroup 同士のみ自動換算可能
const UNIT_BASE_GROUP = {
  g: "weight",
  kg: "weight",
  ml: "volume",
  L: "volume",
  大さじ: "volume",
  小さじ: "volume",
  個: "count_個",
  匹: "count_匹",
  枚: "count_枚",
  本: "count_本",
  束: "count_束",
  合: "weight", // 米の標準的な換算(1合=150g)で重さ系として扱い、kg等と自動換算できるようにする
  少々: "no_quantity",
  適量: "no_quantity",
};

// 各単位 → ベース単位（weightはg、volumeはml）への倍率
const UNIT_TO_BASE_RATE = {
  g: 1,
  kg: 1000,
  ml: 1,
  L: 1000,
  大さじ: 15,
  小さじ: 5,
  個: 1,
  匹: 1,
  枚: 1,
  本: 1,
  束: 1,
  合: 150, // 米1合 ≒ 150g
  少々: 1,
  適量: 1,
};

// 全対応単位リスト（入力フォームのプルダウン用）
const ALL_UNITS = [
  "g", "kg", "ml", "L", "個", "匹", "本", "束", "枚", "合",
  "大さじ", "小さじ", "少々", "適量",
];

// ==========================================================
// レシピジャンル（選択式）
// ==========================================================
const RECIPE_GENRES = [
  "和食", "洋食", "中華", "韓国料理", "イタリアン", "和菓子・デザート", "その他",
];

// レシピの分類（主食/主菜/副菜）。1レシピに複数選択可能（例：主菜にも副菜にもなる料理）
const RECIPE_COURSE_TYPES = ["主食", "主菜", "副菜"];

// ==========================================================
// 食材マスター（サンプルデータ／動作確認用）
// manageType: "quantity"(数量管理) / "no_quantity"(少々・適量のみで管理)
// nutritionPer: 栄養値の基準（100=100gまたは100mlあたり、1=1個/1匹などの単位あたり）
// ==========================================================
const INITIAL_INGREDIENTS = [
  { id: "I001", name: "鯛", category: "魚", unit: "匹", manageType: "quantity", nutritionPer: 1, kcal: 194, protein: 20.6, fat: 9.4, carb: 0.1 },
  { id: "I002", name: "鶏むね肉", category: "肉", unit: "g", manageType: "quantity", nutritionPer: 100, kcal: 116, protein: 23.3, fat: 1.9, carb: 0 },
  { id: "I003", name: "豚バラ肉", category: "肉", unit: "g", manageType: "quantity", nutritionPer: 100, kcal: 386, protein: 14.2, fat: 34.6, carb: 0.1 },
  { id: "I004", name: "卵", category: "乳製品・卵", unit: "個", manageType: "quantity", nutritionPer: 1, kcal: 91, protein: 7.4, fat: 6.2, carb: 0.2 },
  { id: "I005", name: "白だし", category: "調味料", unit: "本", manageType: "quantity", nutritionPer: 100, kcal: 40, protein: 2.5, fat: 0, carb: 7.5 },
  { id: "I006", name: "醤油", category: "調味料", unit: "ml", manageType: "quantity", nutritionPer: 100, kcal: 71, protein: 7.7, fat: 0, carb: 10.1 },
  { id: "I007", name: "米", category: "主食", unit: "合", manageType: "quantity", nutritionPer: 1, kcal: 336, protein: 5.6, fat: 0.9, carb: 74.6 },
  { id: "I008", name: "ニンニクチューブ", category: "調味料", unit: "本", manageType: "quantity", nutritionPer: 100, kcal: 130, protein: 5, fat: 0.3, carb: 26 },
  { id: "I009", name: "玉ねぎ", category: "野菜", unit: "個", manageType: "quantity", nutritionPer: 1, kcal: 37, protein: 1, fat: 0.1, carb: 8.8 },
  { id: "I010", name: "にんじん", category: "野菜", unit: "本", manageType: "quantity", nutritionPer: 1, kcal: 30, protein: 0.6, fat: 0.1, carb: 6.5 },
  { id: "I011", name: "塩", category: "調味料", unit: "g", manageType: "no_quantity", nutritionPer: 100, kcal: 0, protein: 0, fat: 0, carb: 0 },
  { id: "I012", name: "こしょう", category: "調味料", unit: "少々", manageType: "no_quantity", nutritionPer: 100, kcal: 364, protein: 11, fat: 3.3, carb: 68.7 },
  { id: "I013", name: "牛乳", category: "乳製品・卵", unit: "ml", manageType: "quantity", nutritionPer: 100, kcal: 67, protein: 3.3, fat: 3.8, carb: 4.8 },
  { id: "I014", name: "食パン", category: "主食", unit: "枚", manageType: "quantity", nutritionPer: 1, kcal: 158, protein: 5.6, fat: 2.6, carb: 28.0 },
  { id: "I015", name: "ほうれん草", category: "野菜", unit: "束", manageType: "quantity", nutritionPer: 1, kcal: 52, protein: 6.4, fat: 0.9, carb: 7.8 },
  { id: "I016", name: "青ネギ", category: "野菜", unit: "束", manageType: "quantity", nutritionPer: 1, kcal: 68, protein: 3.6, fat: 0.6, carb: 12.5 },
];

// ==========================================================
// サンプルレシピ（動作確認用に1件のみ登録）
// materials の cost は自動計算されるため、ここでは未設定(null)。
// ==========================================================
const INITIAL_RECIPES = [
  {
    id: "R001",
    name: "鯛めし",
    genre: "和食",
    courseTypes: ["主食"],
    cookTime: 40,
    servings: 2,
    rating: 4.5,
    favorite: true,
    mealPlan: false,
    mealPlanAddedAt: null,
    photoUrl: "",
    note: "炊飯器で簡単にできる定番レシピ",
    steps: "1. 鯛に軽く塩を振り、魚焼きグリルで焼き目をつける\n2. 米を研いで炊飯器にセットし、白だしを加える\n3. 焼いた鯛をのせて通常通り炊飯する\n4. 炊き上がったら骨を取り除きほぐして混ぜる",
    materials: [
      { name: "鯛", quantity: 1, unit: "匹", manualCost: null },
      { name: "米", quantity: 2, unit: "合", manualCost: null },
      { name: "白だし", quantity: 3, unit: "大さじ", manualCost: 40 }, // 本→大さじは自動換算不可のため手動入力の例
    ],
  },
];

// ==========================================================
// 購入履歴（サンプル：単価計算・材料費計算の動作確認用）
// type: "self"(自炊/食材購入) / "eatout"(外食)
// ==========================================================
const INITIAL_PURCHASES = [
  { id: "P001", date: todayStr(-5), store: "スーパー", type: "self", name: "鯛", quantity: 2, unit: "匹", price: 1980 },
  { id: "P002", date: todayStr(-5), store: "スーパー", type: "self", name: "米", quantity: 10, unit: "合", price: 600 },
  { id: "P003", date: todayStr(-3), store: "スーパー", type: "self", name: "白だし", quantity: 1, unit: "本", price: 400 },
  { id: "P004", date: todayStr(-2), store: "定食屋", type: "eatout", eatoutType: "solo", name: "", quantity: "", unit: "", price: 950, memo: "ランチ" },
];

// ==========================================================
// 在庫（サンプル）
// ==========================================================
const INITIAL_INVENTORY = [
  { id: "INV001", name: "鯛", quantity: 2, unit: "匹", status: "未開封" },
  { id: "INV002", name: "米", quantity: 10, unit: "合", status: "未開封" },
  { id: "INV003", name: "白だし", quantity: 1, unit: "本", status: "未開封" },
];

// 買い物リスト（初期状態は空）
const INITIAL_SHOPPING_LIST = [];

// 調理履歴（栄養分析用。初期状態は空）
const INITIAL_COOKED_HISTORY = [];

// ==========================================================
// 月別食費予算（サンプル：今月分のみ設定した状態で用意）
// yearMonth: "YYYY-MM"
// ==========================================================
const INITIAL_BUDGETS = [
  { yearMonth: todayStr(0).slice(0, 7), budget: 30000 },
];

// ==========================================================
// 献立候補（ブックマーク）一覧の並び順設定
// ---------------------------------------------------------
// 今後、並び順の選択肢を増やしたい場合はここに追加し、
// utils.js の Utils.sortMealPlanRecipes() の switch 文に
// 対応する比較関数を追加するだけで拡張できる。
// ==========================================================
const MEAL_PLAN_SORT_OPTIONS = [
  { key: "addedDesc", label: "新しく追加した順" },
  // 例: { key: "ratingDesc", label: "評価が高い順" } のように追加可能
];
const MEAL_PLAN_DEFAULT_SORT = "addedDesc";

// ==========================================================
// お金管理機能（家計簿）
// ---------------------------------------------------------
// 既存の「食費管理（購入履歴）」「食費予算」はそのまま維持し、
// この機能はそれらと並行して動く独立した仕組みとして追加している。
// 「食費」は支出カテゴリの一覧に1つだけ含まれるが、実際の金額は
// 購入履歴（自炊/外食）＋支出履歴のお菓子・ジュース分を合算して
// 都度計算するため、支出履歴には「自炊/外食」分は保存しない
// （二重入力を避けるため）。お菓子・ジュースのみ、支出管理画面の
// 専用エリアから「食費」カテゴリの内訳として登録できる。
// ==========================================================

// 支出カテゴリ（種別: "固定費" または "変動費"）
// ※ 元「ジム」は「サブスク」へ統合、元「外食」カテゴリは廃止
//   （食費区分の一部として「食費」カテゴリに統合）
const INITIAL_EXPENSE_CATEGORIES = [
  // 固定費
  { name: "家賃", type: "固定費" },
  { name: "水道光熱費", type: "固定費" },
  { name: "通信費", type: "固定費" },
  { name: "保険", type: "固定費" },
  { name: "サブスク", type: "固定費" },
  // 変動費
  { name: "食費", type: "変動費" },       // 自炊/外食(購入履歴)＋お菓子/ジュース(支出履歴)の合算。金額はここには持たない
  { name: "日用品", type: "変動費" },
  { name: "交通費", type: "変動費" },
  { name: "被服費", type: "変動費" },
  { name: "美容", type: "変動費" },
  { name: "医療", type: "変動費" },
  { name: "教育費", type: "変動費" },
  { name: "趣味", type: "変動費" },
  { name: "交際費", type: "変動費" },
  { name: "投資", type: "変動費" },
  { name: "その他", type: "変動費" },
];

// 食費区分（🛒購入登録＝自炊/外食(一人/複数)、💴支出管理＝お菓子/ジュース）
const FOOD_TYPE_SELF = "自炊";
const FOOD_TYPE_EATOUT_SOLO = "外食（一人）";
const FOOD_TYPE_EATOUT_GROUP = "外食（複数）";
const FOOD_TYPE_SNACK = "お菓子";
const FOOD_TYPE_DRINK = "ジュース";
const FOOD_TYPES_ALL = [FOOD_TYPE_SELF, FOOD_TYPE_EATOUT_SOLO, FOOD_TYPE_EATOUT_GROUP, FOOD_TYPE_SNACK, FOOD_TYPE_DRINK];

// 支出履歴（サンプル：食費以外の動作確認用）
const INITIAL_EXPENSES = [
  { id: "EX001", date: todayStr(-10), category: "家賃", amount: 75000, place: "", memo: "" },
  { id: "EX002", date: todayStr(-8), category: "通信費", amount: 4500, place: "キャリアA", memo: "" },
  { id: "EX003", date: todayStr(-6), category: "サブスク", amount: 1500, place: "", memo: "動画配信・ジム統合" },
];

// 収入履歴（サンプル）
const INITIAL_INCOMES = [
  { id: "IN001", date: todayStr(-15), amount: 250000, source: "給与", memo: "" },
];

// カテゴリ別予算（サンプル：今月分のみ設定）
const INITIAL_CATEGORY_BUDGETS = [
  { yearMonth: todayStr(0).slice(0, 7), category: "食費", budget: 45000 },
  { yearMonth: todayStr(0).slice(0, 7), category: "趣味", budget: 20000 },
  { yearMonth: todayStr(0).slice(0, 7), category: "美容", budget: 10000 },
];

// 1日あたりの栄養目標（初期値。設定画面から変更可能）
const INITIAL_NUTRITION_TARGET = { kcal: 2000, protein: 60, fat: 60, carb: 250 };

// 今日から n 日前の日付文字列(YYYY-MM-DD)を返すヘルパー（サンプルデータ生成用）
function todayStr(offsetDays = 0) {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().slice(0, 10);
}
