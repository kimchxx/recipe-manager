/**
 * photo.js
 * ---------------------------------------------------------
 * レシピ写真のアップロード処理を担当するモジュール。
 *
 * 【保存方式】
 * ・GAS連携済みの場合：選択した画像を圧縮した上でGAS経由でGoogleドライブへ
 *   アップロードし、返ってきた画像URLを「写真URL」欄にセットする
 * ・GAS未連携（フェーズ1のみ）の場合：圧縮した画像をBase64のdata URLとして
 *   そのまま「写真URL」欄にセットする（localStorageに保存されるため、
 *   容量の都合上、保存できる枚数には限りがある）
 *
 * どちらの場合も、最終的に「写真URL」欄（rf-photo）に文字列をセットするだけ
 * なので、recipe.js側の保存処理（saveForm）は変更不要。
 * ---------------------------------------------------------
 */

const Photo = {
  MAX_DIMENSION: 900, // 長辺の最大ピクセル数
  JPEG_QUALITY: 0.75,
  // data URLのままlocalStorageに保存する場合の目安の警告ライン（文字数）
  LOCAL_SIZE_WARN_THRESHOLD: 700 * 1024,

  /** ファイル選択時のメインハンドラ（recipe.jsのフォームから呼ばれる） */
  async handleFileSelect(event) {
    const file = event.target.files && event.target.files[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      alert("画像ファイルを選択してください。");
      return;
    }

    const previewEl = document.getElementById("rf-photo-preview");
    const statusEl = document.getElementById("rf-photo-status");
    const urlInput = document.getElementById("rf-photo");
    if (statusEl) statusEl.textContent = "画像を処理しています...";

    try {
      const { dataUrl, base64, mimeType } = await this.compressImage(file);

      if (previewEl) {
        previewEl.src = dataUrl;
        previewEl.style.display = "block";
      }

      if (typeof GasSync !== "undefined" && GasSync.isConfigured()) {
        if (statusEl) statusEl.textContent = "Googleドライブへアップロードしています...";
        const url = await this.uploadToDrive(base64, mimeType, `recipe_${Date.now()}.jpg`);
        urlInput.value = url;
        if (statusEl) statusEl.textContent = "✅ Googleドライブへ保存しました";
      } else {
        urlInput.value = dataUrl;
        if (statusEl) {
          statusEl.textContent = dataUrl.length > this.LOCAL_SIZE_WARN_THRESHOLD
            ? "⚠ この端末にのみ保存されます（画像サイズが大きめのため、保存できる枚数に限りがあります）"
            : "✅ この端末に保存されます（スプレッドシート連携時はGoogleドライブへ自動保存されます）";
        }
      }
    } catch (err) {
      console.error("写真処理エラー:", err);
      if (statusEl) statusEl.textContent = "";
      alert("写真の処理に失敗しました。\n" + err.message);
    }
  },

  /** 「写真URL」欄に直接テキストが入力された場合にもプレビューを追従させる */
  updateUrlPreview(url) {
    const previewEl = document.getElementById("rf-photo-preview");
    if (!previewEl) return;
    if (url && url.trim()) {
      previewEl.src = url.trim();
      previewEl.style.display = "block";
    } else {
      previewEl.style.display = "none";
    }
  },

  /** 画像ファイルを読み込み、長辺を基準にリサイズ＆JPEG圧縮する */
  compressImage(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error("ファイルの読み込みに失敗しました"));
      reader.onload = () => {
        const img = new Image();
        img.onerror = () => reject(new Error("画像の読み込みに失敗しました"));
        img.onload = () => {
          let { width, height } = img;
          if (width > this.MAX_DIMENSION || height > this.MAX_DIMENSION) {
            if (width >= height) {
              height = Math.round(height * (this.MAX_DIMENSION / width));
              width = this.MAX_DIMENSION;
            } else {
              width = Math.round(width * (this.MAX_DIMENSION / height));
              height = this.MAX_DIMENSION;
            }
          }
          const canvas = document.createElement("canvas");
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext("2d");
          ctx.drawImage(img, 0, 0, width, height);

          const dataUrl = canvas.toDataURL("image/jpeg", this.JPEG_QUALITY);
          const base64 = dataUrl.split(",")[1];
          resolve({ dataUrl, base64, mimeType: "image/jpeg" });
        };
        img.src = reader.result;
      };
      reader.readAsDataURL(file);
    });
  },

  /** 圧縮済みBase64データをGAS経由でGoogleドライブへアップロードする */
  async uploadToDrive(base64, mimeType, fileName) {
    const res = await fetch(GasSync.getUrl(), {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({
        action: "uploadPhoto", data: base64, mimeType, fileName, key: GasSync.getKey(),
      }),
    });
    const json = await res.json();
    if (!json.ok) throw new Error(json.error === "unauthorized" ? "アクセスキーが正しくありません" : (json.error || "アップロードに失敗しました"));
    return json.url;
  },
};
