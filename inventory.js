/**
 * inventory.js
 * ---------------------------------------------------------
 * 在庫管理画面のロジック。
 * ・一覧表示 / 追加 / 編集 / 削除
 * ・レシピ「作った」ボタンからの在庫減算処理
 * ・在庫不足時の買い物リストへの自動追加
 * ---------------------------------------------------------
 */

const Inventory = {
  render() {
    const list = Storage.getInventory();
    const container = document.getElementById("page-content");

    const cards = list.length
      ? list.map((item) => this.cardHtml(item)).join("")
      : `<p class="empty-message">在庫はまだ登録されていません。</p>`;

    container.innerHTML = `
      <div class="page-header">
        <h2>📦 在庫管理</h2>
        <button class="btn btn-primary btn-round" onclick="Inventory.openAddModal()">＋ 在庫を追加</button>
      </div>
      <div class="card-list">${cards}</div>
    `;
  },

  cardHtml(item) {
    const statusClass = item.status === "未開封" ? "status-unopened" : "status-opened";
    return `
      <div class="card inventory-card">
        <div class="card-main">
          <div class="card-title">${Utils.esc(item.name)}</div>
          <div class="card-sub">${Utils.formatQuantity(item.quantity, item.unit)}</div>
          <span class="badge ${statusClass}">${item.status}</span>
        </div>
        <div class="card-actions">
          <button class="btn btn-sm btn-outline" onclick="Inventory.openEditModal('${item.id}')">編集</button>
          <button class="btn btn-sm btn-danger-outline" onclick="Inventory.confirmDelete('${item.id}')">削除</button>
        </div>
      </div>
    `;
  },

  openAddModal() {
    const body = `
      <div class="form-group">
        <label>食材名</label>
        <input type="text" id="inv-name" class="input" placeholder="例: 玉ねぎ" list="ingredient-name-list">
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>数量</label>
          <input type="number" id="inv-quantity" class="input" step="0.01" value="1">
        </div>
        <div class="form-group">
          <label>単位</label>
          <select id="inv-unit" class="input">${ALL_UNITS.map((u) => `<option value="${u}">${u}</option>`).join("")}</select>
        </div>
      </div>
      <div class="form-group">
        <label>状態</label>
        <select id="inv-status" class="input">
          <option value="未開封">未開封</option>
          <option value="開封済み">開封済み</option>
        </select>
      </div>
    `;
    Modal.open("在庫を追加", body, [
      { label: "キャンセル", class: "btn-outline", onClick: () => Modal.close() },
      { label: "追加する", class: "btn-primary", onClick: () => Inventory.saveAdd() },
    ]);

    document.getElementById("inv-name").addEventListener("input", (e) => {
      const suggested = Utils.suggestUnit(e.target.value.trim());
      if (suggested) document.getElementById("inv-unit").value = suggested;
    });
  },

  saveAdd() {
    const name = document.getElementById("inv-name").value.trim();
    const quantity = parseFloat(document.getElementById("inv-quantity").value);
    const unit = document.getElementById("inv-unit").value;
    const status = document.getElementById("inv-status").value;

    if (!name || isNaN(quantity)) {
      alert("食材名と数量を入力してください。");
      return;
    }
    Storage.addInventoryItem({ name, quantity, unit, status });
    Modal.close();
    Inventory.render();
  },

  openEditModal(id) {
    const item = Storage.getInventory().find((i) => i.id === id);
    if (!item) return;
    const body = `
      <div class="form-group">
        <label>食材名</label>
        <input type="text" id="inv-name" class="input" value="${Utils.esc(item.name)}">
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>数量</label>
          <input type="number" id="inv-quantity" class="input" step="0.01" value="${item.quantity}">
        </div>
        <div class="form-group">
          <label>単位</label>
          <select id="inv-unit" class="input">${ALL_UNITS.map((u) => `<option value="${u}" ${u === item.unit ? "selected" : ""}>${u}</option>`).join("")}</select>
        </div>
      </div>
      <div class="form-group">
        <label>状態</label>
        <select id="inv-status" class="input">
          <option value="未開封" ${item.status === "未開封" ? "selected" : ""}>未開封</option>
          <option value="開封済み" ${item.status === "開封済み" ? "selected" : ""}>開封済み</option>
        </select>
      </div>
    `;
    Modal.open("在庫を編集", body, [
      { label: "キャンセル", class: "btn-outline", onClick: () => Modal.close() },
      { label: "保存する", class: "btn-primary", onClick: () => Inventory.saveEdit(id) },
    ]);
  },

  saveEdit(id) {
    const name = document.getElementById("inv-name").value.trim();
    const quantity = parseFloat(document.getElementById("inv-quantity").value);
    const unit = document.getElementById("inv-unit").value;
    const status = document.getElementById("inv-status").value;
    if (!name || isNaN(quantity)) {
      alert("食材名と数量を入力してください。");
      return;
    }
    Storage.updateInventoryItem(id, { name, quantity, unit, status });
    Modal.close();
    Inventory.render();
  },

  confirmDelete(id) {
    if (confirm("この在庫を削除しますか？")) {
      Storage.deleteInventoryItem(id);
      Inventory.render();
    }
  },

  // =========================================================
  // レシピから呼び出される在庫減算処理
  // =========================================================

  /**
   * レシピの材料リストをもとに在庫を減算する。
   * ・少々/適量 → 数量は減らさず、状態のみ「開封済み」に変更
   * ・数量あり → 換算して減算。在庫が無い/不足する場合は買い物リストへ追加
   * ・数量が0になった在庫は削除し、買い物リストへ移動
   */
  consumeForRecipe(materials) {
    const shortages = [];

    materials.forEach((m) => {
      if (m.unit === "少々" || m.unit === "適量") {
        // 少々・適量は数量を減らさず状態のみ変更
        const invList = Storage.getInventory().filter((i) => i.name === m.name);
        if (invList.length === 0) {
          shortages.push(m.name);
        } else {
          invList.forEach((inv) => {
            if (inv.status !== "開封済み") {
              Storage.updateInventoryItem(inv.id, { status: "開封済み" });
            }
          });
        }
        return;
      }

      // 在庫の中から同じ食材を探す（単位が違う場合も換算を試みる）
      const invList = Storage.getInventory().filter((i) => i.name === m.name);
      if (invList.length === 0) {
        shortages.push(`${m.name} ${Utils.formatQuantity(m.quantity, m.unit)}`);
        return;
      }

      // 換算可能な在庫を優先的に消費
      let remaining = m.quantity;
      let remainingUnit = m.unit;

      for (const inv of invList) {
        if (remaining <= 0) break;
        const neededInInvUnit = Utils.convertQuantity(remaining, remainingUnit, inv.unit);
        if (neededInInvUnit === null) continue; // 換算不可な組み合わせはスキップ

        if (inv.quantity >= neededInInvUnit) {
          const newQty = round2(inv.quantity - neededInInvUnit);
          if (newQty <= 0) {
            Storage.deleteInventoryItem(inv.id);
            Storage.addShoppingItem({ name: inv.name, quantity: "", unit: inv.unit, reason: "在庫切れ" });
          } else {
            Storage.updateInventoryItem(inv.id, { quantity: newQty, status: "開封済み" });
          }
          remaining = 0;
        } else {
          // 在庫では足りない分だけ消費して0に
          remaining = Utils.convertQuantity(neededInInvUnit - inv.quantity, inv.unit, remainingUnit) ?? 0;
          remainingUnit = m.unit;
          Storage.deleteInventoryItem(inv.id);
          Storage.addShoppingItem({ name: inv.name, quantity: "", unit: inv.unit, reason: "在庫切れ" });
        }
      }

      if (remaining > 0) {
        shortages.push(`${m.name} ${Utils.formatQuantity(remaining, remainingUnit)}`);
      }
    });

    return shortages; // 呼び出し元(recipe.js)でメッセージ表示に使用
  },

  /**
   * 不足材料をチェックし、買い物リストへ追加する（「不足材料を追加」ボタン用）
   * 在庫が存在しない、または数量0の場合を「不足」とみなす。
   * 少々/適量の食材は判定対象外。
   */
  addMissingMaterialsToShoppingList(materials, recipeName) {
    let addedCount = 0;
    materials.forEach((m) => {
      if (m.unit === "少々" || m.unit === "適量") return; // 対象外

      const invList = Storage.getInventory().filter((i) => i.name === m.name);
      const totalAvailable = invList.reduce((sum, inv) => {
        const converted = Utils.convertQuantity(inv.quantity, inv.unit, m.unit);
        return sum + (converted !== null ? converted : 0);
      }, 0);

      if (invList.length === 0 || totalAvailable <= 0) {
        Storage.addShoppingItem({
          name: m.name,
          quantity: m.quantity,
          unit: m.unit,
          reason: `レシピ: ${recipeName}`,
        });
        addedCount++;
      }
    });
    return addedCount;
  },
};

function round2(num) {
  return Math.round(num * 100) / 100;
}
