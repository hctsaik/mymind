# MyMind 心智圖

一個用瀏覽器就能用的心智圖工具：向右展開的邏輯圖、鍵盤快速編輯、10 種主題、大綱檢視、手機版。
圖**先存在這個瀏覽器**（IndexedDB），不需要帳號；想多台裝置同步、保留版本紀錄時，
可以選擇同步到**你自己的私人 GitHub 儲存庫**（手動或自動，一次同步只產生一個 commit）。
也可以用你自己的 OpenAI 金鑰讓 AI 產生或展開心智圖。

- 線上版：<https://hctsaik.github.io/mymind/>
- 純 HTML / CSS / JavaScript（ES modules），**沒有建置步驟**，用 GitHub Pages 直接發布。
- MIT 授權。

## 隱私與金鑰

- 圖存在這個瀏覽器的 IndexedDB；GitHub 金鑰（PAT）和 OpenAI 金鑰**只存在你這個瀏覽器的 localStorage**，不會上傳到任何其他地方，
  也不會寫進這個程式碼庫。換一台電腦或瀏覽器要重新貼一次。
- 瀏覽器只會直接連到 `api.github.com` 和 `api.openai.com`（網頁的 Content-Security-Policy 只允許這兩個）。
- 共用電腦請在「設定 → 清除這個瀏覽器裡的金鑰」。
- 這個 repo 有自動檢查（`scripts/check-secrets.sh`，pre-commit hook 和 GitHub Actions 都會跑），
  發現像金鑰的字串就拒絕提交。

## 儲存與同步

打開 MyMind 選「先存在這個瀏覽器」就能直接用，GitHub 是選用的。到 **設定 → 儲存與同步** 可以選：

| 同步方式 | 什麼時候上傳到 GitHub | commit 數量 |
|---|---|---|
| **只存瀏覽器**（新使用者預設） | 永遠不上傳，不連網路 | 0 |
| **手動同步到 GitHub**（剛連接 GitHub 時的預設） | 按頁首的「同步」按鈕（徽章顯示幾項未同步）或 Ctrl+S | 每按一次 1 個 |
| **自動同步** | 有修改後最多每 3 分鐘一次；切換分頁或關閉時也會同步 | 每批 1 個 |

- 每次同步會把所有未同步的圖（和永久刪除的圖）用 git data API 寫成**一個 commit**。
- 開啟時、按「同步」時、每 5 分鐘會從 GitHub 讀取其他裝置的修改（只讀，不會產生 commit）。
- 兩邊都改過同一張圖時，可以選「合併兩邊」「保留我的」或「改用雲端（我的另存副本）」。

### ⚠ 瀏覽器儲存可能會被清掉

圖存在這個瀏覽器裡：**清除瀏覽資料／網站資料、使用無痕視窗**時可能會被刪除，換電腦或換瀏覽器也看不到。

- 第一次建立圖時，MyMind 會請瀏覽器「長期保留」資料（`navigator.storage.persist()`）；設定頁可以看狀態。
- **設定 → 儲存與同步 → 匯出全部備份（.mymind）**：一個 JSON 檔，包含所有圖（含垃圾桶），不含金鑰。
- **從備份還原**（或首頁「匯入大綱」選 `.mymind` 檔）：沒有的圖新增，同一張圖保留較新的版本。
- 只存瀏覽器時，7 天沒備份首頁會提醒你。

## 連接 GitHub（選用）

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
7. 打開 MyMind → 歡迎頁的「連接 GitHub」，或左下角齒輪 **設定 → GitHub 與 AI**：
   - 資料儲存庫：`hctsaik/mymind-data`
   - 金鑰：貼上剛剛的 `github_pat_…`
   - 按 **測試**，看到「連線成功 · 私人儲存庫 · 可讀寫」後按 **儲存**（同步方式會自動設成「手動同步」，可以到「儲存與同步」改成自動）。
8. 原本只存在瀏覽器的圖會顯示在「同步」按鈕的徽章上，按一次「同步」就會全部上傳（1 個 commit）。

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
- 搜尋節點（Ctrl+F，手機在頂端的放大鏡）：即時標出所有符合的節點（標題和備註都會找），Enter／F3 下一個、Shift+Enter／Shift+F3 上一個，收合中的分支會自動展開並移到畫面中央，Esc 關閉。
- 大綱檢視（Ctrl+O）、心智圖清單（搜尋、排序、星號、垃圾桶）、快捷鍵說明（?）。
- 設定 → 外觀與無障礙：淺色線條、深色介面、減少動態效果。
- 同步：每次修改先存在瀏覽器，3 秒後自動推到 GitHub（Ctrl+S 立即儲存）；離線時保留修改，恢復連線後自動同步。
- 衝突：另一台裝置先改過時，可以選「合併兩邊」「保留我的」或「改用雲端（我的另存副本）」。
- 版本紀錄：每次儲存是一個 commit，可以預覽舊版本並還原。
- AI：輸入主題或貼上筆記產生新圖；選一個節點用 AI 展開（Ctrl+J）。
- 匯入 Markdown / OPML / .mymind.json / .mymind 備份；匯出 PNG（2x）、SVG、PDF（A4 一頁、自動橫／直向符合頁面）、Markdown、OPML、JSON。
- 安裝成 App（PWA）：Android Chrome 會在首頁顯示「把 MyMind 安裝到主畫面」，也可以從「⋯」選單安裝；iPhone 請用 Safari 的「分享 › 加入主畫面」。安裝後沒有網路也能開啟、看圖和編輯（同步和 AI 需要網路）。
- 更新：有新版本時畫面下方會出現「有新版本，重新整理」，按下才會切換，不會在編輯途中突然重新載入。

### Markdown 複製／貼上

- **貼上變節點**：選一個節點後按 Ctrl+V（Mac 為 ⌘V），剪貼簿裡的 Markdown 會變成它底下的子主題；整次貼上可以用一次 Ctrl+Z 復原。
- **複製為 Markdown**：選一個節點按 Ctrl+C，整個分支會以 Markdown 放進剪貼簿（中心主題是 `# 標題`，子主題是縮排的 `- ` 清單），可直接貼到筆記軟體；貼回 MyMind 時會保留圖示、優先順序等完整結構。Ctrl+X 剪下。
- **從 Markdown 匯入／貼上**（Ctrl+Shift+V、匯出選單、手機的「⋯」選單、首頁「匯入／貼上大綱」）：貼上或選檔後即時預覽，可選擇加到選取節點底下或建立新的心智圖。
- 手機：長按節點 →「複製 Markdown」「貼上 Markdown」。
- 編輯文字時貼上仍是純文字；貼上多行文字時會提示「轉成節點」。
- 匯出 › 整張圖 Markdown：同時複製到剪貼簿並下載 .md。
- 支援的語法：標題 `#`～`######`；清單 `-` `*` `+` `1.` `1)`，用 2／4 個空白或 Tab 縮排；一般縮排文字；標題和清單混用；待辦 `- [ ]`／`- [x]`（打勾＝完成）；`> 引言` 成為上一個節點的備註。粗體、斜體、程式碼、刪除線等行內格式會移除，連結保留文字，網址存在備註（「連結：…」）。空行、分隔線會略過，程式碼區塊的每一行當一般文字。
- 只有一個最上層項目（例如一個 `#` 標題）時，它就是整個分支／新圖的中心主題；有多個時會成為並列的子主題（建立新圖時第一個當中心主題）。

## 本機開發

```bash
python3 -m http.server 8765     # 然後打開 http://localhost:8765/
npm i                           # 只有測試需要（playwright-core）
node tests/markdown.mjs         # Markdown 解析／匯出單元測試（不需瀏覽器）
node tests/pwa.mjs              # 離線、可安裝、更新提示（會自己開一個暫時的伺服器）
node tests/e2e.mjs              # 端對端測試（GitHub 和 OpenAI 都是模擬的）：只存瀏覽器、手動同步、自動批次同步、備份還原、舊資料搬移
GH_TOKEN=… node tests/roundtrip.mjs   # 對真的 mymind-data 做讀寫往返（金鑰只從環境變數讀，結束會刪掉測試圖）
node tests/audit.mjs            # 對比度 / 點擊範圍 / 重疊檢查
git config core.hooksPath .githooks   # 啟用提交前的金鑰檢查和版本檢查
```

### 發佈新版本

改了 `index.html`、`css/`、`js/`、`icons/` 時，請把 `sw.js` 和 `js/version.js` 的 `VERSION` 一起加一（提交前的檢查會擋下忘記改版本的提交）。新增 JS／CSS 檔案時也要加進 `sw.js` 的 `SHELL` 清單。

```bash
bash scripts/check-version.sh   # 檢查版本一致、離線清單完整
```

測試需要 Chromium；可以用 `CHROME=/path/to/chrome` 指定。

## 檔案

```
index.html          入口
css/app.css         樣式
js/app.js           狀態、路由、編輯互動、同步
js/mapview.js       版面配置與 SVG 繪製
js/views.js         介面模板
js/github.js        GitHub Contents API（讀）＋ git data API（一次同步一個 commit）
js/merge.js         三方合併（依節點 id）
js/ai.js            OpenAI Chat Completions
js/io.js            匯入／匯出
js/store.js         IndexedDB（圖）＋ localStorage（設定、金鑰）
js/version.js       版本號（和 sw.js 一致）
sw.js               Service worker：離線 App 外殼、版本快取
manifest.webmanifest、icons/   PWA 安裝資訊與圖示（scripts/make-icons.mjs 重新產生）
```

設計文件原本規劃 Vite + TypeScript；依需求改成不需要建置的純 JS 版本。
