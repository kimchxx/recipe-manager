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
  searchKeyword: "",

  render() {
    this.searchKeyword = "";
    const container = document.getElementById("page-content");
    container.innerHTML = `
      <div class="page-header">
        <h2>📦 在庫管理</h2>
        <button class="btn btn-primary btn-round" onclick="Inventory.openAddModal()">＋ 在庫を追加</button>
      </div>
      <div class="search-bar">
        <input type="text" id="inv-search" class="input" placeholder="🔍 食材名で検索"
          oninput="Inventory.onSearch(this.value)">
      </div>
      <div class="card-list" id="inventory-list"></div>
    `;
    this.renderList();
  },

  onSearch(value) {
    this.searchKeyword = value;
    this.renderList();
  },

  renderList() {
    let list = Storage.getInventory();
    const kw = this.searchKeyword.trim().toLowerCase();
    if (kw) list = list.filter((i) => i.name.toLowerCase().includes(kw));

    // 同じ食材名が2件以上ある場合は「重複」として検出する
    const nameCounts = {};
    list.forEach((i) => { nameCounts[i.name] = (nameCounts[i.name] || 0) + 1; });

    const duplicates = list
      .filter((i) => nameCounts[i.name] >= 2)
      .sort((a, b) => a.name.localeCompare(b.name, "ja"));
    const singles = list.filter((i) => nameCounts[i.name] < 2);

    // 重複しているものを一番上にまとめて表示する
    const sorted = [...duplicates, ...singles];

    const container = document.getElementById("inventory-list");
    if (sorted.length === 0) {
      container.innerHTML = `<p class="empty-message">${this.searchKeyword ? "該当する在庫が見つかりませんでした。" : "在庫はまだ登録されていません。"}</p>`;
      return;
    }
    container.innerHTML = sorted.map((item) => this.cardHtml(item, nameCounts[item.name] >= 2)).join("");
  },

  cardHtml(item, isDuplicate) {
    const statusClass = item.status === "未開封" ? "status-unopened" : "status-opened";
    return `
      <div class="card inventory-card ${isDuplicate ? "inventory-card-duplicate" : ""}">
        <div class="card-main">
          <div class="card-title">${Utils.esc(item.name)}${isDuplicate ? ` <span class="duplicate-badge">重複</span>` : ""}</div>
          <div class="card-sub">${Utils.formatQuantity(item.quantity, item.unit)}</div>
          <span class="badge ${statusClass}">${item.status}</span>
        </div>
        <div class="card-actions">
          ${isDuplicate ? `<button class="btn btn-sm btn-primary" onclick="Inventory.mergeDuplicates('${item.id}')">🔗 合算</button>` : ""}
          <button class="btn btn-sm btn-outline" onclick="Inventory.openEditModal('${item.id}')">編集</button>
          <button class="btn btn-sm btn-danger-outline" onclick="Inventory.confirmDelete('${item.id}')">削除</button>
        </div>
      </div>
    `;
  },

  /**
   * 同じ食材名の在庫を1件にまとめる。
   * ・g⇔kg、ml⇔Lなど換算可能な単位同士はベース単位（g/ml）に揃えて合算する
   * ・個・匹・枚・本・合など、単位が一致するものはそのまま合算する
   * ・単位が異なり換算もできない組み合わせ（例: 個 と g）は合算せずそれぞれ残す
   * ・状態は、合算対象のどれか1つでも「開封済み」なら「開封済み」にする
   */
  mergeDuplicates(itemId) {
    const target = Storage.getInventory().find((i) => i.id === itemId);
    if (!target) return;
    const name = target.name;

    const allItems = Storage.getInventory();
    const sameNameItems = allItems.filter((i) => i.name === name);
    if (sameNameItems.length < 2) return;

    const groups = {}; // 単位グループ(weight/volume/count_個 等) -> 合算対象
    const untouched = []; // no_quantity(少々・適量)など合算対象外

    sameNameItems.forEach((item) => {
      const group = UNIT_BASE_GROUP[item.unit];
      if (!group || group === "no_quantity") {
        untouched.push(item);
        return;
      }
      if (!groups[group]) groups[group] = { totalBase: 0, anyOpened: false, items: [] };
      const rate = UNIT_TO_BASE_RATE[item.unit] ?? 1;
      groups[group].totalBase += item.quantity * rate;
      if (item.status === "開封済み") groups[group].anyOpened = true;
      groups[group].items.push(item);
    });

    const rest = allItems.filter((i) => i.name !== name);
    const merged = [];
    let mergedCount = 0;

    Object.keys(groups).forEach((group) => {
      const g = groups[group];
      if (g.items.length < 2) {
        merged.push(...g.items); // このグループ内では重複していないのでそのまま
        return;
      }
      const baseUnit = group === "weight" ? "g" : group === "volume" ? "ml" : g.items[0].unit;
      merged.push({
        id: g.items[0].id,
        name,
        quantity: round2(g.totalBase),
        unit: baseUnit,
        status: g.anyOpened ? "開封済み" : "未開封",
      });
      mergedCount += g.items.length;
    });

    Storage.setInventory([...rest, ...merged, ...untouched]);

    if (mergedCount > 0) {
      Toast.show(`「${name}」を1件にまとめました`);
    } else {
      Toast.show("単位の異なる在庫は自動で合算できませんでした。編集画面から単位を揃えてください。");
    }
    this.renderList();
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
          <input type="number" id="inv-quantity" class="input" step="1" value="1">
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
    Inventory.renderList();
  },

  openEditModal(id) {
    const item = Storage.getInventory().find((i) => i.id === id);
    if (!item) return;
    const body = `
      <div class="form-group">
        <label>食材名</label>
        <input type="text" id="inv-name" class="input" value="${Utils.esc(item.name)}" list="ingredient-name-list">
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>数量</label>
          <input type="number" id="inv-quantity" class="input" step="1" value="${item.quantity}">
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
    Inventory.renderList();
  },

  confirmDelete(id) {
    if (confirm("この在庫を削除しますか？")) {
      Storage.deleteInventoryItem(id);
      Inventory.renderList();
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
   * 在庫が存在しない、または必要数に満たない場合を「不足」とみなす。
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

      // 在庫が全く無い場合だけでなく、必要数に満たない場合も不足として扱う
      if (totalAvailable < m.quantity) {
        const shortfall = round2(m.quantity - totalAvailable);
        Storage.addShoppingItem({
          name: m.name,
          quantity: shortfall > 0 ? shortfall : m.quantity,
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
