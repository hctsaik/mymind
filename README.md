# MyMind 心智圖

一個用瀏覽器就能用的心智圖工具：向右展開的邏輯圖、鍵盤快速編輯、10 種主題、大綱檢視、手機版，
資料存在**你自己的私人 GitHub 儲存庫**（每次儲存都是一個 commit，所以有完整版本紀錄），
也可以用你自己的 OpenAI 金鑰讓 AI 產生或展開心智圖。

- 線上版：<https://hctsaik.github.io/mymind/>
- 純 HTML / CSS / JavaScript（ES modules），**沒有建置步驟**，用 GitHub Pages 直接發布。
- MIT 授權。

## 隱私與金鑰

- GitHub 金鑰（PAT）和 OpenAI 金鑰**只存在你這個瀏覽器的 localStorage**，不會上傳到任何其他地方，
  也不會寫進這個程式碼庫。換一台電腦或瀏覽器要重新貼一次。
- 瀏覽器只會直接連到 `api.github.com` 和 `api.openai.com`（網頁的 Content-Security-Policy 只允許這兩個）。
- 共用電腦請在「設定 → 清除這個瀏覽器裡的金鑰」。
- 這個 repo 有自動檢查（`scripts/check-secrets.sh`，pre-commit hook 和 GitHub Actions 都會跑），
  發現像金鑰的字串就拒絕提交。

## 第一次設定

### 1. 建立資料儲存庫

建立一個**私人**儲存庫，例如 `hctsaik/mymind-data`（裡面放一個 README 和空的 `maps/` 資料夾即可）。
每張心智圖會存成 `maps/<id>.json`。

### 2. 建立 GitHub 金鑰（Fine-grained personal access token）

1. 登入 GitHub，右上角頭像 → **Settings** → 左側最下面 **Developer settings**
   → **Personal access tokens** → **Fine-grained tokens** → **Generate new token**。
   （直接網址：<https://github.com/settings/personal-access-tokens/new>）
2. **Token name**：`MyMind`；**Expiration**：建議 90 天（到期後再建一個新的貼上即可）。
3. **Resource owner**：選你自己（`hctsaik`）。
4. **Repository access**：選 **Only select repositories**，只勾 **`hctsaik/mymind-data`**。
   不要選 All repositories。
5. **Permissions** → **Repository permissions** → **Contents** 設成 **Read and write**。
   （**Metadata: Read-only** 會自動加上，這是必要的。其他權限都不用開。）
6. 按 **Generate token**，複製以 `github_pat_` 開頭的金鑰（只會顯示一次）。
7. 打開 MyMind → 「連接 GitHub」或左下角齒輪 **設定 → GitHub 同步**：
   - 資料儲存庫：`hctsaik/mymind-data`
   - 金鑰：貼上剛剛的 `github_pat_…`
   - 按 **測試連線**，看到「連線成功 · 私人儲存庫 · 可讀寫」後按 **儲存**。

### 3. 取得 OpenAI API 金鑰（AI 功能才需要）

1. 到 <https://platform.openai.com/> 登入（可以用 ChatGPT 的帳號，但 API 是分開計費的）。
2. 左側 **Settings → Billing** 儲值或綁定付款方式；建議在 **Limits** 設每月用量上限。
3. 到 **API keys**（<https://platform.openai.com/api-keys>）→ **Create new secret key**，
   名稱填 `MyMind`，建立後複製以 `sk-` 開頭的金鑰（只會顯示一次）。
4. MyMind **設定 → OpenAI**：貼上金鑰；模型預設 `gpt-4o-mini`（可以改成其他支援 JSON 輸出的 Chat Completions 模型）。
5. 金鑰是從瀏覽器直接呼叫 OpenAI，請只在自己的裝置上使用，並設定用量上限。

## 功能

- 編輯：Tab 新增子主題、Enter 同級、Shift+Tab 升一層、空白鍵/F2 編輯、Delete 刪除、Ctrl+. 收合、
  Alt+↑↓ 調整順序、方向鍵移動選取、拖曳節點改變位置（放到上方／下方／成為子節點）、Ctrl+Z / Ctrl+Y。
- 圖示、優先順序 1–5、完成勾選、螢光標記、備註（Ctrl+Alt+M）。
- 樣式抽屜（Alt+Y）：10 種主題（預設「珊瑚」）、節點、線條（括號／曲線／直線、粗細、間距）、畫布。
- 大綱檢視（Ctrl+O）、心智圖清單（搜尋、排序、星號、垃圾桶）、快捷鍵說明（?）。
- 設定 → 外觀與無障礙：淺色線條、深色介面、減少動態效果。
- 同步：每次修改先存在瀏覽器，3 秒後自動推到 GitHub（Ctrl+S 立即儲存）；離線時保留修改，恢復連線後自動同步。
- 衝突：另一台裝置先改過時，可以選「合併兩邊」「保留我的」或「改用雲端（我的另存副本）」。
- 版本紀錄：每次儲存是一個 commit，可以預覽舊版本並還原。
- AI：輸入主題或貼上筆記產生新圖；選一個節點用 AI 展開（Ctrl+J）。
- 匯入 Markdown / OPML / .mymind.json；匯出 PNG（2x）、SVG、Markdown、OPML、JSON。

## 本機開發

```bash
python3 -m http.server 8765     # 然後打開 http://localhost:8765/
npm i                           # 只有測試需要（playwright-core）
node tests/e2e.mjs              # 端對端測試（GitHub 和 OpenAI 都是模擬的）
node tests/audit.mjs            # 對比度 / 點擊範圍 / 重疊檢查
git config core.hooksPath .githooks   # 啟用提交前的金鑰檢查
```

測試需要 Chromium；可以用 `CHROME=/path/to/chrome` 指定。

## 檔案

```
index.html          入口
css/app.css         樣式
js/app.js           狀態、路由、編輯互動、同步
js/mapview.js       版面配置與 SVG 繪製
js/views.js         介面模板
js/github.js        GitHub Contents API
js/merge.js         三方合併（依節點 id）
js/ai.js            OpenAI Chat Completions
js/io.js            匯入／匯出
js/store.js         localStorage（設定、金鑰、離線快取）
```

設計文件原本規劃 Vite + TypeScript；依需求改成不需要建置的純 JS 版本。
