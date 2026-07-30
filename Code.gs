/**
 * Code.gs
 * ---------------------------------------------------------
 * 「おうちごはん手帖」フェーズ2 バックエンド（Google Apps Script）
 *
 * 【使い方】
 * 1. 連携させたいGoogleスプレッドシートを開く
 * 2. 拡張機能 > Apps Script を開く
 * 3. このファイルの内容を貼り付ける
 * 4. 下の ACCESS_KEY を、自分だけが知っている合言葉に書き換える（必須）
 * 5. 関数「setupSheets」を実行し、シート雛形を作成する（初回のみ）
 * 6. 「デプロイ > 新しいデプロイ」→ 種類「ウェブアプリ」
 *    - 実行ユーザー: 自分
 *    - アクセスできるユーザー: 全員（匿名ユーザーを含む）
 *      ※ GitHub Pages（別ドメイン）の fetch() から呼び出すため、
 *        「自分のみ」にするとGoogleのログイン確認が挟まりAPIとして
 *        動作しません。代わりに下記 ACCESS_KEY による認証で
 *        第三者からのアクセスを防ぎます。
 * 7. 発行されたウェブアプリURLと、ACCESS_KEYに設定した合言葉を
 *    アプリ側の「設定」画面（⚙）に入力する
 *    ※ 合言葉はアプリのソースコードには書き込まれず、
 *      入力した端末のブラウザ内にのみ保存されます
 *
 * 【設計方針】
 * ・シートの列見出しは仕様書通り日本語のまま（スプレッドシートを人が見て分かるように）
 * ・読み込みは1回のリクエストで全シートをまとめて返す（getAll）
 * ・書き込みはシート単位の「全件洗い替え（replaceSheet）」方式
 *   → 個人利用規模のデータ量なら十分高速で、行番号のズレ等の不整合が起きにくいため
 * ・全リクエストで ACCESS_KEY の一致を確認し、一致しない場合は処理を行わない
 * ---------------------------------------------------------
 */

// ==========================================================
// アクセスキー（合言葉）
// ---------------------------------------------------------
// 必ず推測されにくい文字列に書き換えてください（例: ランダムな英数字20文字程度）。
// このキーとウェブアプリURLの両方を知っている人だけがデータを読み書きできます。
// ==========================================================
const ACCESS_KEY = "ここを自分だけの合言葉に書き換えてください";

/** リクエストのキーが正しいか確認する */
function isAuthorized(key) {
  return typeof key === "string" && key.length > 0 && key === ACCESS_KEY;
}

// ==========================================================
// シート定義（シート名 と 列見出し）
// ここを変更すると setupSheets() で作られるシートも変わる
// ==========================================================
const SHEET_DEFS = {
  ingredients: { name: "食材マスター", headers: ["食材ID", "食材名", "カテゴリ", "標準単位", "管理タイプ", "kcal", "タンパク質", "脂質", "炭水化物"] },
  unitConversions: { name: "単位変換", headers: ["単位", "変換先", "換算値"] },
  categories: { name: "カテゴリ", headers: ["カテゴリID", "カテゴリ名"] },
  purchases: { name: "購入履歴", headers: ["日付", "店名", "区分", "食材", "数量", "単位", "金額", "メモ"] },
  inventory: { name: "在庫", headers: ["食材", "数量", "単位", "状態"] },
  recipes: { name: "レシピ", headers: ["レシピID", "料理名", "ジャンル", "調理時間", "人数", "評価", "材料費", "お気に入り", "献立候補", "献立候補追加日時", "作り方", "写真URL", "備考"] },
  recipeMaterials: { name: "レシピ材料", headers: ["レシピID", "材料", "数量", "単位", "材料費"] },
  shoppingList: { name: "買い物リスト", headers: ["食材", "数量", "単位", "理由", "状態"] },
  cookedHistory: { name: "調理履歴", headers: ["レシピID", "日付"] },
  settings: { name: "設定", headers: ["対象年月", "食費予算"] },
};
// ※ 仕様書の一覧に無い追加列について：
//   ・「レシピ」の「作り方」「写真URL」：アプリの作り方テキスト・写真URL入力を保存するため
//   ・「レシピ」の「献立候補」「献立候補追加日時」：献立候補（ブックマーク）機能の状態・並び順保持のため
//   ・「購入履歴」の「区分」：自炊／外食の判定のため（値は「自炊」または「外食」）
//   ・「購入履歴」の「メモ」：外食登録時の任意メモを保存するため
//   ・「調理履歴」「設定」シート：栄養分析の集計、月別食費予算の保存のためにシート自体を追加

// ==========================================================
// エントリーポイント
// ==========================================================

function doGet(e) {
  try {
    const action = (e.parameter && e.parameter.action) || "getAll";
    const key = e.parameter && e.parameter.key;

    // pingは接続確認用のため、キー不一致でも「未認証である」ことだけ分かる応答を返す
    if (action === "ping") {
      if (!isAuthorized(key)) return jsonResponse({ ok: false, error: "unauthorized" });
      return jsonResponse({ ok: true, message: "connected" });
    }
    if (!isAuthorized(key)) return jsonResponse({ ok: false, error: "unauthorized" });

    if (action === "getAll") {
      const result = {};
      Object.keys(SHEET_DEFS).forEach((k) => {
        result[k] = getSheetObjects(k);
      });
      return jsonResponse({ ok: true, data: result });
    }
    return jsonResponse({ ok: false, error: "unknown action" });
  } catch (err) {
    return jsonResponse({ ok: false, error: String(err) });
  }
}

function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents);
    if (!isAuthorized(body.key)) return jsonResponse({ ok: false, error: "unauthorized" });

    const action = body.action;
    if (action === "replaceSheet") {
      setSheetObjects(body.sheet, body.rows || []);
      return jsonResponse({ ok: true });
    }
    if (action === "backup") {
      const url = backupNow();
      return jsonResponse({ ok: true, backupUrl: url });
    }
    if (action === "uploadPhoto") {
      const url = uploadPhoto(body.data, body.mimeType, body.fileName);
      return jsonResponse({ ok: true, url: url });
    }
    return jsonResponse({ ok: false, error: "unknown action" });
  } catch (err) {
    return jsonResponse({ ok: false, error: String(err) });
  }
}

function jsonResponse(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

// ==========================================================
// シート読み書き共通処理
// ==========================================================

function getSheet(sheetKey) {
  const def = SHEET_DEFS[sheetKey];
  if (!def) throw new Error("未定義のシートキー: " + sheetKey);
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(def.name);
  if (!sheet) {
    sheet = ss.insertSheet(def.name);
    sheet.appendRow(def.headers);
  }
  return sheet;
}

/** シートの全データ行を、見出し行をキーにしたオブジェクト配列で返す */
function getSheetObjects(sheetKey) {
  const def = SHEET_DEFS[sheetKey];
  const sheet = getSheet(sheetKey);
  const values = sheet.getDataRange().getValues();
  if (values.length < 2) return [];
  const headers = values[0];
  return values.slice(1)
    .filter((row) => row.some((cell) => cell !== "" && cell !== null))
    .map((row) => {
      const obj = {};
      headers.forEach((h, i) => { obj[h] = row[i]; });
      return obj;
    });
}

/** シートのデータ行（見出し以下）を全て書き換える */
function setSheetObjects(sheetKey, rows) {
  const def = SHEET_DEFS[sheetKey];
  const sheet = getSheet(sheetKey);
  const headers = def.headers;

  const lastRow = sheet.getLastRow();
  if (lastRow > 1) {
    sheet.getRange(2, 1, lastRow - 1, headers.length).clearContent();
  }
  if (rows.length === 0) return;

  const values = rows.map((row) => headers.map((h) => (row[h] !== undefined ? row[h] : "")));
  sheet.getRange(2, 1, values.length, headers.length).setValues(values);
}

// ==========================================================
// 初回セットアップ（Apps Scriptエディタから手動実行する）
// ==========================================================

function setupSheets() {
  Object.keys(SHEET_DEFS).forEach((key) => {
    const def = SHEET_DEFS[key];
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sheet = ss.getSheetByName(def.name);
    if (!sheet) {
      sheet = ss.insertSheet(def.name);
    }
    if (sheet.getLastRow() === 0) {
      sheet.appendRow(def.headers);
    }
    sheet.setFrozenRows(1);
  });

  // デフォルトで作成される「シート1」が空なら削除
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const defaultSheet = ss.getSheetByName("シート1");
  if (defaultSheet && defaultSheet.getLastRow() === 0) {
    ss.deleteSheet(defaultSheet);
  }

  SpreadsheetApp.getUi().alert("シートのセットアップが完了しました。");
}

// ==========================================================
// バックアップ（データ消失対策）
// ---------------------------------------------------------
// 現在のスプレッドシート全体を、同じDriveフォルダ内に
// タイムスタンプ付きでコピー保存する。
// ==========================================================

function backupNow() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const file = DriveApp.getFileById(ss.getId());
  const parents = file.getParents();
  const folder = parents.hasNext() ? parents.next() : DriveApp.getRootFolder();

  const stamp = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyyMMdd_HHmmss");
  const copy = file.makeCopy(`${ss.getName()}_backup_${stamp}`, folder);
  return copy.getUrl();
}

/**
 * 毎日自動バックアップしたい場合は、この関数を一度だけ実行してください。
 * （Apps Scriptエディタの実行ボタンで createDailyBackupTrigger を実行）
 * 以降は毎日AM3時ごろに自動でバックアップが作成されます。
 */
function createDailyBackupTrigger() {
  // 既存の同名トリガーがあれば重複作成しないよう削除してから再作成
  ScriptApp.getProjectTriggers().forEach((t) => {
    if (t.getHandlerFunction() === "backupNow") ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger("backupNow").timeBased().everyDays(1).atHour(3).create();
  SpreadsheetApp.getUi().alert("毎日自動バックアップを設定しました。");
}

// ==========================================================
// レシピ写真のアップロード（Googleドライブ保存）
// ---------------------------------------------------------
// アプリ側でリサイズ・圧縮済みのBase64データを受け取り、
// 専用フォルダにアップロードして「リンクを知っている全員が閲覧可」の
// 共有設定にした上で、<img>タグに直接埋め込める画像URLを返す。
// ==========================================================

const PHOTO_FOLDER_NAME = "おうちごはん手帖_写真";

function getOrCreatePhotoFolder() {
  const folders = DriveApp.getFoldersByName(PHOTO_FOLDER_NAME);
  if (folders.hasNext()) return folders.next();
  return DriveApp.createFolder(PHOTO_FOLDER_NAME);
}

/**
 * @param {string} base64Data - Base64エンコードされた画像データ（data:...;base64, の接頭辞は除く）
 * @param {string} mimeType - 例: "image/jpeg"
 * @param {string} fileName - 保存時のファイル名
 * @return {string} <img>タグにそのまま使える画像URL
 */
function uploadPhoto(base64Data, mimeType, fileName) {
  const folder = getOrCreatePhotoFolder();
  const decoded = Utilities.base64Decode(base64Data);
  const blob = Utilities.newBlob(decoded, mimeType || "image/jpeg", fileName || ("photo_" + Date.now() + ".jpg"));
  const file = folder.createFile(blob);
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  // 通常の共有リンクは<img>への直埋め込みに向かないため、サムネイル配信用のURL形式を使う
  return "https://drive.google.com/thumbnail?id=" + file.getId() + "&sz=w1000";
}
