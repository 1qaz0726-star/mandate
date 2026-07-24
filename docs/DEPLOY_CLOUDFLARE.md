# Cloudflare Workers 部署

Mandate 可用 **Cloudflare Workers + Static Assets** 一鍵部署（前端 `public/` + API `/api/*` 同一網域）。

## 前置

1. [Cloudflare 帳號](https://dash.cloudflare.com/)
2. Node.js 18+

## 第一次部署

在 `mandate/` 目錄：

```powershell
npm install
npx wrangler login
```

（選填）設定 OpenAI Key，主控版 AI 三幕 Demo 才會跑 Agent：

```powershell
npx wrangler secret put OPENAI_API_KEY
```

部署：

```powershell
npm run deploy:cf
```

成功後終端機會顯示網址，例如：

`https://mandate.<你的子網域>.workers.dev`

## 本機預覽 Cloudflare 版

```powershell
npm run dev:cf
```

本地 `.dev.vars`（勿 commit）可放：

```
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4o-mini
```

## 自訂網域（選填）

Cloudflare Dashboard → Workers & Pages → mandate → Settings → Domains → Add custom domain。

## 限制（Demo 須知）

| 項目 | 說明 |
|------|------|
| 狀態 | Demo 資料在 Worker **記憶體**，冷啟動或閒置後可能重置 |
| AI | 未設 `OPENAI_API_KEY` 時仍可用按鈕備援三幕 |
| 機密 | **勿**把 API Key 寫進 `wrangler.toml`；用 `wrangler secret` |

## 與本地 `npm start` 差異

| | `npm start` | Cloudflare |
|--|-------------|------------|
| 埠 | `127.0.0.1:3847` | HTTPS 443 |
| API | `/api` | 同左（同源） |
| 環境變數 | `.env` | `wrangler secret` / Dashboard |

## 更新部署

改完程式後：

```powershell
npm run smoke
npm run deploy:cf
```
