# form2json

本機田徑終點紀錄表轉檔 demo。上傳 A4 橫式照片後，系統會校正透視、切成 8 組，交由 LM Studio 的 `google/gemma-4-e4b` 辨識，再提供人工校正及 JSON、CSV、XLSX 下載。

## 啟動

```bash
pnpm install
uv sync --project api
lms server start
lms load google/gemma-4-e4b --gpu max -y
pnpm dev
```

開啟 `http://127.0.0.1:5173`。

「載入已校正範例」不需要啟動 LM Studio。真實照片辨識需要本機模型已載入，或設定 DeepSeek API key。

## DeepSeek

複製 `.env.example` 為 `.env`，填入 API key：

```bash
AI_PROVIDER=deepseek
DEEPSEEK_API_KEY=your-api-key
DEEPSEEK_MODEL=deepseek-flash
```

後端會使用 DeepSeek 的 `deepseek-flash` 視覺模型。API key 只留在 FastAPI 程序，不會送到瀏覽器。設定完成後重新啟動 `pnpm dev`。

## 設定

後端預設連線到 `http://127.0.0.1:1234`，模型預設為 `google/gemma-4-e4b`。可用環境變數覆寫：

```bash
LM_STUDIO_BASE_URL=http://127.0.0.1:1234
LM_STUDIO_MODEL=google/gemma-4-e4b
```

若要用較慢但對部分手寫表格更準確的 Qwen 模型：

```bash
lms load qwen/qwen3.8-27b --gpu max -c 16384 -y
LM_STUDIO_MODEL=qwen/qwen3.8-27b pnpm dev
```

## 驗證

```bash
pnpm test
pnpm test:api
pnpm test:e2e
pnpm build
```

暫存工作保留 30 分鐘，圖片只會傳到本機 LM Studio。
