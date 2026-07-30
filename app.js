/**
 * app.js
 * ---------------------------------------------------------
 * アプリのエントリーポイント。
 * ・初期化処理
 * ・下部ナビゲーションによる画面切替（SPAルーティング）
 * ・共通UIコンポーネント（モーダル / トースト）
 * ・食材名オートコンプリート用 datalist の生成
 * ---------------------------------------------------------
 */

const App = {
  currentPage: "home",

  pages: {
    home: Home,
    purchase: Purchase,
    inventory: Inventory,
    recipe: Recipe,
    analysis: Analysis,
    shopping: Shopping,
  },

  async init() {
    Storage.initializeData();
    this.renderIngredientDatalist();

    if (typeof GasSync !== "undefined" && GasSync.isConfigured()) {
      try {
        Toast.show("スプレッドシートと同期しています...");
        await GasSync.pullAll();
      } catch (err) {
        console.error(err);
        Toast.show("スプレッドシートとの同期に失敗しました。オフラインのデータを表示します");
      }
    }
    this.navigate("home");
  },

  navigate(pageKey) {
    const page = this.pages[pageKey];
    if (!page) return;
    this.currentPage = pageKey;
    page.render();
    this.updateNavActive(pageKey);
    document.getElementById("app-main").scrollTop = 0;
  },

  updateNavActive(pageKey) {
    document.querySelectorAll(".nav-item").forEach((el) => {
      el.classList.toggle("active", el.dataset.page === pageKey);
    });
  },

  /** 食材名入力欄のオートコンプリート候補を生成（食材マスター名を反映） */
  renderIngredientDatalist() {
    let el = document.getElementById("ingredient-name-list");
    if (!el) {
      el = document.createElement("datalist");
      el.id = "ingredient-name-list";
      document.body.appendChild(el);
    }
    const names = Storage.getIngredients().map((i) => i.name);
    el.innerHTML = names.map((n) => `<option value="${Utils.esc(n)}"></option>`).join("");
  },
};

// =============================================================
// モーダル共通コンポーネント
// =============================================================
const Modal = {
  open(title, bodyHtml, buttons) {
    const root = document.getElementById("modal-root");
    root.innerHTML = `
      <div class="modal-overlay" onclick="Modal.closeIfOverlay(event)">
        <div class="modal-box">
          <div class="modal-header">
            <span>${Utils.esc(title)}</span>
            <button class="modal-close" onclick="Modal.close()">✕</button>
          </div>
          <div class="modal-body">${bodyHtml}</div>
          <div class="modal-footer" id="modal-footer"></div>
        </div>
      </div>
    `;
    const footer = document.getElementById("modal-footer");
    buttons.forEach((btn, idx) => {
      const b = document.createElement("button");
      b.className = `btn ${btn.class}`;
      b.textContent = btn.label;
      b.onclick = btn.onClick;
      footer.appendChild(b);
    });
    root.classList.add("open");
  },

  closeIfOverlay(e) {
    if (e.target.classList.contains("modal-overlay")) this.close();
  },

  close() {
    const root = document.getElementById("modal-root");
    root.classList.remove("open");
    root.innerHTML = "";
  },
};

// =============================================================
// トースト通知
// =============================================================
const Toast = {
  show(message) {
    let el = document.getElementById("toast");
    if (!el) {
      el = document.createElement("div");
      el.id = "toast";
      document.body.appendChild(el);
    }
    el.textContent = message;
    el.classList.add("show");
    clearTimeout(this._timer);
    this._timer = setTimeout(() => el.classList.remove("show"), 2400);
  },
};

document.addEventListener("DOMContentLoaded", () => App.init());
