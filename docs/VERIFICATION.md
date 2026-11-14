# 驗證紀錄與驗收邊界

本次環境：Windows PowerShell、Node 24.22.1、系統 Google Chrome。沒有提供 Supabase URL / publishable key，Docker daemon 未啟動。沒有使用遠端資料庫、套用正式 Migration、建立真實帳號或部署。

最終檢查：TypeScript、Lint 與建置通過；核心／API／PostgreSQL 測試 **10 / 10** 通過；桌機、平板與手機瀏覽器適用案例 **10 / 10** 通過。手機專用案例不在桌機／平板重複執行，因此完整矩陣另有 2 項不適用而跳過。`npm audit` 全部相依套件為 **0 vulnerabilities**。真實 Supabase 測試 **1 項跳過**，原因是缺少連線資訊與測試帳號，不能視為已完成正式資料庫驗收。

手機優先更新另驗證 320×568、360×740、390×844、430×932 的首屏主操作、底部五入口、觸控尺寸、輸入字體、鍵盤避讓、商品固定試穿入口與試穿底部收藏按鈕；手機完整路徑共 4 項瀏覽器測試。建置產物也以 Chrome 驗證手機導覽與 AI 入口。詳見 [手機 UI / UX 說明](MOBILE-UX.md)。

瀏覽器涵蓋註冊、雙角度上傳與確認、身形與胸圍、偏好與授權、自然語言推薦、直接沿用分身、真實 Sharp Demo 合成、保存、重整、登出登入、收藏保留與私人資料刪除。相機測試使用 Canvas 測試串流，不是實體鏡頭。三種尺寸皆檢查無水平溢出。測試圖片是合成測試人物，截圖位於 `artifacts/`，包含首頁、試穿室與衣櫃的三種尺寸，不含真實私人照片。

## 自動化驗證種類

- `npm run typecheck`：前後端、共用型別與測試 TypeScript。
- `npm run lint`：ESLint、TypeScript、React Hooks。
- `npm run build`：TypeScript + Vite 本機產物。
- `npm run test:build`：實際啟動建置產物與 Node 服務，以 Chrome 驗證首頁、動態載入的商品頁、私人頁面登入保護、未設定 Supabase 時阻擋假註冊，以及拒絕讀取 `.env`／原始伺服器程式。此測試刻意不連接遠端資料庫。
- `npm test`：推薦預算／庫存／商品來源、身形表單邊界、真實 Sharp WebP 合成、未授權外傳阻擋、實際 Node HTTP API 成功／失敗／冪等／Origin、PostgreSQL Migration 與 RLS。
- `npm run test:e2e`：系統 Chrome 桌機與手機尺寸。使用**實際 React、Node API、Sharp**，但 Supabase Auth / REST / Storage 是 `tests/fixtures/supabase.ts` 的 HTTP contract 替身，只供測試，不會在一般啟動時啟用。
- `npm run test:live`：真實 Supabase 唯讀雙帳號驗收入口；沒有測試帳密時跳過，不能列為驗證成功。

PGlite 測試會執行原始 Migration 與商品 seed，補上最小 auth/storage 平台 schema，再實際執行 PostgreSQL RLS。涵蓋匿名公開商品、匿名不可讀私有資料、他人不可讀寫 profile/avatar/tryon/outfit、不可上傳到他人資料夾、不可引用他人分身、刪除分身 cascade。這能檢查 SQL 與 policy 邏輯，**不等於 Supabase 託管 Auth / Storage API 的實際部署測試**。

## 真實 Supabase 驗收

先依 README 在獨立測試專案套用 Migration。準備 A、B 兩個可登入測試帳號，最好讓 A 完成分身建立；測試腳本只讀取與驗證，不新增或刪除資料。設定以下環境變數後執行 `npm run test:live`：

```text
TEST_SUPABASE_URL
TEST_SUPABASE_PUBLISHABLE_KEY
TEST_USER_A_EMAIL
TEST_USER_A_PASSWORD
TEST_USER_B_EMAIL
TEST_USER_B_PASSWORD
```

不要將測試密碼寫入 Git。若要使用 `.env.test`，可執行：

```powershell
node --env-file=.env.test --import tsx --test tests/live/*.test.ts
```

## 需人工或外部環境驗收

- 實體相機硬體、手機 Safari 權限、真實不同拍攝光線。拍照需要 HTTPS 或 localhost；不支援時可上傳。
- 真實 Email 驗證、重設密碼收信與 callback。
- 真實 Supabase persistent storage、跨裝置登入、網路中斷與大型檔案情境。
- 正式 LLM / 試穿供應商、影像品質與授權資料傳送；目前完全為可替換介面。

## 可見限制

- 首頁使用本機下載照片，商品是八件自建展示 SKU／SVG，沒有既有商店可串接。
- 基本照片品質檢查不包含人物偵測、模糊辨識或人體測量。
- Demo 試穿僅固定位置、主色、固定比例疊合，畫面和圖片內皆標明 Demo。
- 前端刷新可重讀已完成的試穿；同步圖片任務在程序中止時可能留下 processing 狀態，需要重新生成或清理。
- Storage / DB 無跨服務交易；刪除或換照失敗可再次操作，正式上線需要補償任務。
