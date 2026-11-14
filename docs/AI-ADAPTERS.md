# API 與正式 AI 串接

目前正式 AI 沒有設定、沒有發送真實照片至供應商；預設為 Demo。外部服務失敗會顯示失敗，不會偷偷改成 Demo。

## 網站 API

| API | 登入 | 請求／回應 |
| --- | --- | --- |
| `GET /api/health` | 否 | `{ok,database:"supabase",configured}`，僅代表程序可回應，不是資料庫健康保證 |
| `GET /api/config` | 否 | 前端所需公開 Supabase URL / publishable key、模式與設定狀態；不回傳秘密 key |
| `GET /api/products` | 否 | `{products,source}`；有設定時只讀 Supabase，不會在 DB 出錯時悄悄換假資料 |
| `POST /api/recommend` | 是 | `{prompt}` → `{mode,message,recommendations:[{product_id,reason}]}` |
| `POST /api/tryons` | 是 | `{request_id,product_id,size,color}` → 已儲存的 tryon row；重複 request_id 回傳同筆紀錄 |

POST 必須使用 `Content-Type: application/json`、Supabase 使用者 Bearer JWT，且通過 Origin 檢查。後端以 `auth.getUser(token)` 驗證，使用相同 JWT 建立受 RLS 保護的 client。登入者每分鐘最多 20 次 AI 請求，一人同時最多一張試穿（本機單程序限制）。商品、尺寸、庫存與顏色由後端重新查資料庫驗證，不信任前端傳入名稱／價格。

試穿資料狀態 `processing → completed / failed`，完成後存入 Private Storage，結果 row 包含模式、商品、尺寸、顏色、avatar_id。前端有處理中、完成、失敗、重試、重開結果與保存穿搭。載入條為不定進度，不假裝回報供應商完成百分比。同步 API 若服務或程序中斷，processing 記錄可能留下，可在衣櫃發起新試穿；正式環境建議改為帶 worker、逾時回收、webhook 和冪等任務的工作佇列。

其他個人資料 API 透過 Supabase SDK 的受 RLS 保護 PostgREST / Storage API；沒有自行建立可公開讀取照片的路由。

## 推薦 HTTP Adapter

1. 在你自己的後端整合選定 LLM，將其包裝成以下契約。網址和秘密放入 `AI_RECOMMENDATION_URL`、`AI_RECOMMENDATION_KEY`。
2. 將 `RECOMMENDATION_MODE=ai`；在個人衣櫃明確開啟外部 AI 授權。
3. KIKI POST JSON，Authorization 使用後端秘密：

```json
{
  "instruction": "只從提供的商品選擇，不捏造資料…",
  "prompt": "上台報告適合的外套",
  "products": [{ "id": "cloud-blazer", "name": "雲感落肩西裝外套", "price": 2480, "sizes": [] }],
  "profile": { "fit_preference": "微寬鬆" },
  "body": { "height": 168, "weight": 60, "chest": 92 }
}
```

上例 products 為省略示意；實際送出完整資料庫商品與尺寸。有關閉個人化授權時，`profile`、`body` 都是 null。**不送照片、暱稱、email、user_id**。25 秒逾時、回應上限 100 KB。

服務回傳：

```json
{
  "message": "已挑選適合提案場合的單品",
  "recommendations": [
    { "product_id": "cloud-blazer", "reason": "俐落外套可作為正式場合的選擇" }
  ]
}
```

KIKI 會驗證格式、商品 ID、重複項與現有庫存。為避免模型自由文字捏造價格、尺寸或合身保證，**只採用模型的選品 ID**，畫面理由與商品卡片重新從商品庫、使用者需求和已授權身形組合。模型的 message / reason 目前不直接展示。

## 試穿 HTTP Adapter

1. 選定真實 virtual try-on 供應商，於自有後端轉接它的圖片格式、非同步工作 API 或 webhook。把轉接服務包裝為以下同步契約，或新增 `TryonAdapter`。
2. `.env` 設定 `AI_TRYON_URL`、`AI_TRYON_KEY`、`TRYON_MODE=ai`，並在衣櫃授權外部 AI 傳送照片。
3. KIKI POST：

```json
{
  "person_image_base64": "…使用者私人正面照…",
  "garment_image_base64": "…商品素材…",
  "garment_mime": "image/svg+xml",
  "product_id": "cloud-blazer",
  "size": "M",
  "color": "燕麥灰"
}
```

4. 服務回傳：

```json
{ "image_base64": "…", "mime_type": "image/png" }
```

KIKI 不接受任意遠端圖片 URL，以免引入 SSRF／公開私人照片。請求 60 秒逾時、回應最多 20 MB，圖片解碼限制 40 MP，再轉為 WebP 存入私人 bucket。

**目前素材為 SVG 示意服裝，不是適用所有試穿模型的商品攝影**。正式接入需補齊有使用權、去背或符合供應商規格的實拍圖；可以在 Adapter 中轉格式，但不能因此宣稱已具備真實材質、布料或合身模擬。其他顏色需有對應素材或正式服務能處理顏色的證據。模型不支援尺寸控制時，不得將 size 參數描述成實際影像的尺寸控制。

身形值**沒有傳到試穿 API**。如需以量測資料驅動姿態、3D avatar 或影像，需另建供應商支援的資料契約、校準、驗證與使用者說明，完成後才能宣稱支援。個人化推薦與外部服務授權彼此獨立。

## 上線前仍需完成的整合

- 真實供應商契約、測試、錯誤碼、圖片品質、隱私／保留期限與刪除機制。
- 在獨立 Supabase 測試專案驗證註冊、驗證郵件、RLS、私人檔案及兩帳號隔離。
- 正式背景工作佇列、分散式限制頻率、重啟恢復與跨 Storage / DB 失敗清理。
- Session 風險、CSP／防 XSS、正式網域 HTTPS、監控、資料備份與還原。
- 本 Demo 未實作付款、訂單、真實商品後台、庫存扣除與結帳，不能當成正式交易系統。
