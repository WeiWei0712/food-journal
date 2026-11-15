# 好好吃｜每日飲食與熱量追蹤網站

使用 **GitHub Pages + Supabase** 的繁體中文飲食日誌。**不用 Node.js、不用打包、不用架設自己的後端。**

## 功能

- Email / 密碼註冊、登入、登出、忘記密碼與重設密碼
- 新增、編輯、刪除每日飲食紀錄；可選日期、早餐／午餐／晚餐／點心、份量、卡路里與備註
- 選填蛋白質、碳水化合物與脂肪；自動加總每日熱量與營養素
- 自訂每日卡路里目標，顯示進度與「距離目標」
- 以選定日期為終點的近七天熱量長條圖
- 手機、平板、電腦適用；登入相同帳號即可同步資料
- PostgreSQL Row Level Security (RLS) 避免使用者跨帳號讀寫

> 本專案是**自行輸入營養資訊**的紀錄工具，不會拍照辨識食物、查詢食物資料庫或自動推算熱量。預設 2,000 kcal 只是介面初始值，**不是**依個人條件計算的健康建議。

## 專案檔案

```text
food-journal-supabase/
├── index.html       網站畫面
├── styles.css       響應式版型與樣式
├── app.js           前端互動、Supabase 登入與資料操作
├── config.js        需填入你的 Supabase URL 與 publishable key
├── favicon.svg      網站圖示
├── schema.sql       PostgreSQL 建表 + RLS 權限政策
├── .nojekyll        告訴 GitHub Pages 直接部署靜態檔
└── README.md        這份教學
```

## 一、建立 Supabase 專案

1. 前往 https://supabase.com/dashboard ，註冊或登入。
2. 選擇 **New project**，填寫專案名稱（例如 `food-journal`）、資料庫密碼與區域，建立專案。
3. 完成建立後，從左邊開啟 **SQL Editor → New query**。
4. 打開本專案的 `schema.sql`，**複製全部 SQL**，貼進 SQL Editor，按 **Run**。
5. 到 **Table Editor** 檢查出現 `food_entries` 與 `user_settings` 兩張表。
6. 前往 **Authentication → Sign In / Providers → Email**，確認已允許 Email 登入／註冊。正式開放註冊時，建議保留 **Confirm email**（信箱驗證）。

**安全設定已包含在 SQL 裡：** `food_entries`、`user_settings` 都會啟用 RLS；未登入者不能讀寫；已登入者僅可操作與自己 `user_id` 相同的資料。**不可略過第 4 步。**

## 二、填寫 Supabase 連線設定

1. 在 Supabase 專案中開啟 **Project Settings → API Keys**（也可以按專案上的 **Connect** 查詢連線資訊）。
2. 複製 **Project URL**，例如 `https://abcdefgh.supabase.co`。
3. 複製 **Publishable key**，開頭是 `sb_publishable_`。
4. 編輯本專案 `config.js`，將兩個示範值換成你的資料：

```js
export const SUPABASE_URL = 'https://abcdefgh.supabase.co';
export const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_請換成你的公開金鑰';
```

**非常重要：** `config.js` 會公開在網路上，所以只能填 **Publishable key**（舊版 `anon` key 在過渡期也可用），**絕對不能**放 `Secret key`、舊版 `service_role`、資料庫密碼、SMTP 密碼。Supabase 使用 RLS 保護公開客戶端的資料存取。

## 三、上傳並部署到 GitHub Pages

1. 登入 https://github.com/ ，按右上角 **+ → New repository**。
2. Repository name 輸入 `food-journal`（可換成其他名稱），建議選 **Public**，按 **Create repository**。
3. 在新 Repository 按 **Add file → Upload files**。
4. 先將下載的 ZIP **解壓縮**，上傳**資料夾裡的所有檔案**，不是將外層資料夾或 ZIP 本身上傳。請確保 `index.html` 位於 Repository 根目錄，而不是某個子目錄。
5. 按 **Commit changes**。
6. 進入 Repository **Settings → Pages**。
7. 在 **Build and deployment → Source** 選 **Deploy from a branch**。
8. Branch 選 `main`，資料夾選 `/(root)`，按 **Save**。
9. 完成部署後，專案網站網址類似：

```text
https://你的GitHub帳號.github.io/food-journal/
```

網站剛部署好時可能還會顯示登入頁或初始化提示。如果顯示初始化提示，請檢查 `config.js` 的兩個欄位。

> GitHub Pages 是靜態網站主機，無法自行執行資料庫或伺服器端程式。登入和資料儲存直接由瀏覽器透過 Supabase 安全連線完成。

## 四、設定註冊信與密碼重設的回跳網址

1. 回到 Supabase Dashboard。
2. 選 **Authentication → URL Configuration**。
3. **Site URL** 填入你的 GitHub Pages **完整網站根網址**（注意最後的 `/`），例如：

```text
https://你的GitHub帳號.github.io/food-journal/
```

4. 在 **Redirect URLs** 增加**相同**的完整網址，按儲存。
5. 若也要在本機測試，可另加 `http://localhost:8000/`。
6. 註冊新帳號後，驗證信及忘記密碼信的連結就能回到這個網站。

若使用自己的 GitHub Pages 自訂網域，請以自訂網域取代上述 URL，兩個欄位保持一致。程式會自動依使用中的網址設定 `emailRedirectTo` 與 `redirectTo`。

## 五、重要：驗證信郵件寄送限制

Supabase 內建的測試寄信服務只適合開發：預設**只能寄給你 Supabase 組織團隊內已授權的信箱**，且有很低的發信配額（官方文件目前為每小時 2 封，限制可能調整）。

- **自己測試**：先用 Supabase 專案組織成員的 Email 註冊。
- **開放其他人註冊與忘記密碼**：請在 **Authentication → SMTP Settings** 設定第三方 SMTP 郵件服務，並測試驗證／重設信是否能寄到一般外部信箱。郵件寄送服務可能另行收費。
- 測試期間可以暫時關閉「Confirm email」讓帳號不用收信就可登入，**但正式上線不建議關閉**，因為會讓人能以未驗證的地址註冊；而且「忘記密碼」仍需能寄信的 SMTP。

更多說明：https://supabase.com/docs/guides/auth/auth-smtp

## 六、實際測試

1. 開啟你的 GitHub Pages 網站。
2. 點 **建立帳號**，輸入信箱與密碼。若啟用信箱驗證，先收信、點連結，再登入。
3. 點 **記錄一餐**，選擇日期／餐別／名稱／熱量並儲存。
4. 確認熱量總和、餐別列表及週趨勢有更新。
5. 點目標熱量的編輯圖示，改成自訂目標。
6. 用另一台手機或電腦登入**同一個帳號**，確認顯示相同紀錄（跨裝置同步）。
7. 用**不同帳號**登入，確認無法看到上一個帳號的紀錄。
8. 測試編輯、刪除、登出與「忘記密碼」（後者需要可寄信的 SMTP）。

### 本機預覽（可選）

在本專案資料夾啟動一個靜態伺服器，例如已安裝 Python 時：

```bash
python -m http.server 8000
```

瀏覽 `http://localhost:8000/`。若測試 Email 驗證／忘記密碼，記得先在 Supabase `Redirect URLs` 增加 `http://localhost:8000/`。直接以 `file://` 雙擊打開 `index.html` 可能因瀏覽器的 JavaScript Module 安全限制而失敗。

## 常見問題

**Q：出現「差一小步，就能開始記錄」？**  
A：請確認 `config.js` 已填入有效的 Supabase URL 與 Publishable key，且修改已提交到 GitHub。

**Q：登入後顯示 `permission denied`、`relation does not exist` 或一直無法載入紀錄？**  
A：回到 SQL Editor 完整執行 `schema.sql`，檢查資料表與 RLS 政策；確認設定的是正確的 Supabase 專案。

**Q：註冊信無法寄出 / `Email address not authorized`？**  
A：預設 Supabase 測試寄信只寄給組織授權信箱。要讓一般用戶註冊，請設定自訂 SMTP（見第五節）。

**Q：密碼重設後跑到 localhost 或 404？**  
A：檢查 Supabase **Site URL** 和 **Redirect URLs** 是否包含完整 GitHub Pages 網址與末尾 `/`，尤其 `/<repository>/` 這一段不能遺漏。

**Q：可以自動辨識食物或拍照嗎？**  
A：這一版沒有食物資料庫與影像辨識；目前熱量與營養素都手動填寫，可未來擴充食品資料庫或 API。

**Q：紀錄是存在 GitHub 嗎？**  
A：不是。GitHub 只存公開程式碼，個人的飲食資料存 Supabase Postgres 資料庫，靠帳號 + RLS 進行存取控制。

**Q：這個服務完全免費嗎？**  
A：GitHub Pages 可在其使用限制內免費用於符合規範的靜態專案；Supabase 有免費額度，但容量、用量及長期未使用的專案限制會依官方方案而變。正式對外開放郵件登入通常還需要自訂 SMTP，相關服務可能產生費用。

## 安全與維護提醒

- **不要提交** secret / service_role key、Supabase 資料庫密碼、SMTP 憑證到 GitHub。
- `config.js` 中的 **Publishable key 是公開的**；真正的資料隔離依賴 Supabase Auth + SQL 裡的 RLS。
- GitHub Pages 網站建議使用 HTTPS；GitHub Pages 預設支援 HTTPS。
- 使用者登入狀態會由 Supabase JS 用瀏覽器儲存空間保存，公用電腦使用完請登出。
- Supabase 是資料唯一儲存端；如有重要長期紀錄，請定期備份資料庫。
- 這是自我管理工具，不提供臨床營養建議。

## 官方參考

- GitHub Pages 部署：https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site
- Supabase JavaScript：https://supabase.com/docs/reference/javascript/initializing
- Supabase RLS：https://supabase.com/docs/guides/database/postgres/row-level-security
- Supabase API Keys：https://supabase.com/docs/guides/getting-started/api-keys
- Supabase Auth URL：https://supabase.com/docs/guides/auth/redirect-urls
- Supabase SMTP：https://supabase.com/docs/guides/auth/auth-smtp