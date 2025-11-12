This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Supabase 集成（鉴权 + 上传）

### 1) 环境变量
参考 `env.example` 新建本地环境文件（Windows PowerShell 示例）：
```powershell
Copy-Item env.example .env.local
# 打开 .env.local 填入你的 Supabase 项目配置
```
需要配置：
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `NEXT_PUBLIC_SUPABASE_BUCKET`（可选，默认 `uploads`）

### 2) 鉴权与页面
- 登录页：`/login`
- 注册页：`/signup`
- 受保护的上传页：`/upload`（未登录将被重定向到登录页）

相关代码：
- 客户端实例：`lib/supabase.ts`
- 鉴权守卫：`app/components/AuthGuard.tsx`
- 导航与注销：`app/components/Header.tsx`

### 3) 文件上传（含等待态）
- 请在 Supabase Dashboard -> Storage 中创建存储桶（默认代码使用 `uploads`，也可通过 `NEXT_PUBLIC_SUPABASE_BUCKET` 指定）。建议先设置为 Public 方便调试；生产环境可配合 RLS/签名 URL。
- 访问 `/upload`，选择文件后点击“上传”。上传期间会显示“上传中...”等待态，完成后显示可访问的 `publicUrl`

若遇到 “Bucket not found”：
- 确认你在 Storage 中确实创建了对应名称的存储桶（与 `NEXT_PUBLIC_SUPABASE_BUCKET` 或默认 `uploads` 一致）
- 确认已在本地 `.env.local` 中设置并重启本地开发服务

### 4) 本地运行
1. 设置 `.env.local`
2. `npm install`
3. `npm run dev`
4. 浏览器打开 `http://localhost:3000`

## Realtime（WebSocket）示例
- 页面：`/realtime`（导航中可点击 Realtime）
- 功能：Presence 在线成员 + Broadcast 简易群聊
- 要求：登录后访问（使用 AuthGuard）

如需数据库变更订阅（Postgres Changes），可以在代码中为某表开启 Realtime（Supabase -> Database -> Replication -> Publications）后，添加：
```ts
// 示例：订阅 public.test 表的任意变更
// supabase.channel('db_changes')
//   .on('postgres_changes', { event: '*', schema: 'public', table: 'test' }, (payload) => { ... })
//   .subscribe()
```

### 聊天消息历史（可选）
- 新建表：
  ```sql
  create table if not exists public.messages (
    id text primary key,
    user_id uuid references auth.users(id),
    email text,
    text text not null,
    created_at timestamp with time zone default now()
  );
  ```
- 为该表启用 Realtime：Database -> Replication -> Publications -> 选中 `messages`。
- 设置 RLS 策略（最简示例）：
  ```sql
  alter table public.messages enable row level security;

  create policy "insert messages for authenticated"
    on public.messages for insert
    to authenticated
    with check (true);

  create policy "select messages for authenticated"
    on public.messages for select
    to authenticated
    using (true);
  ```
- 现在 `/realtime` 将：
  - 首次加载拉取最近 200 条 `messages`，作为历史。
  - 监听 `postgres_changes` 的 INSERT 实时追加新消息。
  - 发送消息时会写入 `messages`，并通过 Broadcast 让未启用订阅时也能看到实时消息。

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
