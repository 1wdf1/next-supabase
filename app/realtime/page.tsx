"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import AuthGuard from "@/app/components/AuthGuard";

// 消息类型（包含头像）
type ChatMessage = {
  id: string;
  userId: string;
  email: string | null;
  text: string;
  ts: number;
  avatarUrl: string | null;
};

// 带过期时间的头像缓存（10分钟有效期）
type CachedAvatar = {
  url: string | null;
  expire: number; // 过期时间戳
};
const userAvatarCache = new Map<string, CachedAvatar>();

export default function RealtimeDemoPage() {
  const [email, setEmail] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [userAvatar, setUserAvatar] = useState<string | null>(null); // 当前用户头像
  const [connected, setConnected] = useState(false);
  const [peers, setPeers] = useState<Record<string, Array<{ online_at: string }>>>({});
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const listRef = useRef<HTMLDivElement | null>(null);

  // 生成唯一ID
  const generateId = () => {
    try {
      if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
        return crypto.randomUUID();
      }
    } catch { }
    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  };

  // 滚动到底部
  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  // 加载当前用户信息（含自己的头像）
  useEffect(() => {
    const fetchCurrentUser = async () => {
      const { data } = await supabase.auth.getUser();
      if (data.user) {
        setEmail(data.user.email ?? null);
        setUserId(data.user.id ?? null);
        // 从自己的元数据中获取头像
        const avatar = data.user.user_metadata?.avatar_url ?? null;
        setUserAvatar(avatar);
        // 存入缓存（设置10分钟过期）
        userAvatarCache.set(data.user.id, {
          url: avatar,
          expire: Date.now() + 10 * 60 * 1000
        });
      }
    };
    fetchCurrentUser();
  }, []);

  // 核心：通过用户ID查询头像（带缓存）
  const getAvatarByUserId = async (userId: string): Promise<string | null> => {
    // 检查缓存是否有效
    const cached = userAvatarCache.get(userId);
    if (cached && Date.now() < cached.expire) {
      return cached.url;
    }

    // 调用函数查询头像
    const { data, error } = await supabase.rpc(
      "get_user_avatar",
      { user_id: userId }
    );

    if (error || !data) {
      userAvatarCache.set(userId, { url: null, expire: Date.now() + 10 * 60 * 1000 });
      return null;
    }

    // 缓存结果（10分钟过期）
    const avatarUrl = data as string | null;
    userAvatarCache.set(userId, {
      url: avatarUrl,
      expire: Date.now() + 10 * 60 * 1000
    });
    return avatarUrl;
  };

  // 处理实时消息（补充头像）
  const channelName = useMemo(() => "room_demo", []);
  useEffect(() => {
    if (!userId) return;

    const channel = supabase.channel(channelName, {
      config: { presence: { key: userId } }
    });

    // 同步在线成员
    channel.on("presence", { event: "sync" }, () => {
      const state = channel.presenceState<{ online_at: string }>();
      setPeers(state);
    });

    // 接收广播消息：去重处理
    channel.on("broadcast", { event: "message" }, async ({ payload }) => {
      const rawMsg = payload as Omit<ChatMessage, "avatarUrl">;
      // 关键：检查消息是否已存在（避免与数据库订阅重复）
      if (messages.some(m => m.id === rawMsg.id)) return;
      
      const avatarUrl = await getAvatarByUserId(rawMsg.userId);
      setMessages(prev => [...prev, { ...rawMsg, avatarUrl }]);
    });

    // 订阅数据库变更（历史消息）
    const dbChannel = supabase
      .channel("db:messages")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages" },
        async (payload) => {
          const row = payload.new as any;
          const rawMsg = {
            id: row.id as string,
            userId: (row.user_id as string) || "",
            email: (row.email as string) ?? null,
            text: row.text as string,
            ts: new Date(row.created_at as string).getTime(),
          };
          const avatarUrl = await getAvatarByUserId(rawMsg.userId);
          setMessages(prev => 
            prev.some(m => m.id === rawMsg.id) ? prev : [...prev, { ...rawMsg, avatarUrl }]
          );
        }
      )
      .subscribe();

    // 订阅频道
    channel.subscribe((status) => {
      if (status === "SUBSCRIBED") {
        setConnected(true);
        channel.track({ online_at: new Date().toISOString() });
      }
    });

    return () => {
      setConnected(false);
      supabase.removeChannel(channel);
      supabase.removeChannel(dbChannel);
    };
  }, [channelName, userId, messages]); // 依赖messages进行去重判断

  // 加载历史消息（并行查询头像，提升速度）
  useEffect(() => {
    const loadHistory = async () => {
      const { data, error } = await supabase
        .from("messages")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(10); // 适当增加历史消息数量

      if (!error && Array.isArray(data)) {
        // 转换原始消息格式
        const rawMessages = data.reverse().map((row: any) => ({
          id: row.id as string,
          userId: (row.user_id as string) || "",
          email: (row.email as string) ?? null,
          text: row.text as string,
          ts: new Date(row.created_at as string).getTime(),
        }));

        // 并行查询所有头像（关键优化：从串行改为并行）
        const messagesWithAvatars = await Promise.all(
          rawMessages.map(async (msg) => ({
            ...msg,
            avatarUrl: await getAvatarByUserId(msg.userId)
          }))
        );

        setMessages(messagesWithAvatars);
      }
    };
    loadHistory();
  }, []);

  // 发送消息（去除本地重复添加）
  const sendMessage = async () => {
    if (!connected || !userId || !email) return;
    const text = input.trim();
    if (!text) return;

    const msg: Omit<ChatMessage, "avatarUrl"> = {
      id: generateId(),
      userId,
      email,
      text,
      ts: Date.now()
    };

    setInput("");
    // 发送广播
    await supabase.channel(channelName).send({
      type: "broadcast",
      event: "message",
      payload: msg
    });
    // 写入数据库（通过数据库订阅触发UI更新，避免重复）
    await supabase.from("messages").insert({
      user_id: userId,
      email,
      text: msg.text,
    });
  };

  // 在线人数统计
  const onlineCount = useMemo(() => Object.keys(peers).length, [peers]);
  const connectionCount = useMemo(() => 
    Object.values(peers).reduce((acc, arr) => acc + arr.length, 0), 
  [peers]);

  return (
    <AuthGuard>
      <main style={{ maxWidth: 720, margin: "48px auto", padding: 16, display: "grid", gap: 16 }}>
        <h1 style={{ fontSize: 24, fontWeight: 600 }}>Realtime 聊天室（带头像）</h1>
        <p style={{ color: "#555" }}>
          当前用户：{email ?? "加载中..."}　
          |　连接状态：{connected ? "已连接" : "未连接"}　
          |　在线人数：{onlineCount}（连接数：{connectionCount}）
        </p>

        <section style={{ display: "grid", gap: 8 }}>
          <h2 style={{ fontSize: 16, fontWeight: 600 }}>群聊消息</h2>
          <div
            ref={listRef}
            style={{
              border: "1px solid #e5e7eb",
              borderRadius: 8,
              height: 300,
              padding: 12,
              overflowY: "auto",
              background: "#fafafa"
            }}
          >
            {messages.map((m) => (
              <div key={m.id} style={{ 
                marginBottom: 12, 
                display: "flex", 
                gap: 10,
                justifyContent: m.userId === userId ? "flex-end" : "flex-start"
              }}>
                {/* 头像显示（带加载失败容错） */}
                <div style={{
                  width: 40,
                  height: 40,
                  borderRadius: "50%",
                  overflow: "hidden",
                  border: "1px solid #eee",
                  flexShrink: 0
                }}>
                  {m.avatarUrl ? (
                    <img
                      src={m.avatarUrl}
                      alt={`${m.email}的头像`}
                      style={{ width: "100%", height: "100%", objectFit: "cover" }}
                      onError={(e) => {
                        // 头像加载失败时显示默认头像
                        (e.target as HTMLImageElement).src = "";
                      }}
                    />
                  ) : (
                    <div style={{
                      width: "100%",
                      height: "100%",
                      background: "#64748b",
                      color: "white",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 16
                    }}>
                      {m.email?.charAt(0).toUpperCase() || "?"}
                    </div>
                  )}
                </div>

                {/* 消息内容 */}
                <div style={{ maxWidth: "70%" }}>
                  <div style={{ fontSize: 12, color: "#64748b" }}>
                    {m.email ?? m.userId} · {new Date(m.ts).toLocaleTimeString()}
                  </div>
                  <div style={{
                    padding: "8px 12px",
                    borderRadius: 8,
                    background: m.userId === userId ? "#3b82f6" : "#ffffff",
                    color: m.userId === userId ? "white" : "black",
                    boxShadow: "0 1px 2px rgba(0,0,0,0.1)"
                  }}>
                    {m.text}
                  </div>
                </div>
              </div>
            ))}
            {messages.length === 0 && (
              <div style={{ color: "#94a3b8", textAlign: "center", padding: "40px 0" }}>
                还没有消息，发一条试试吧～
              </div>
            )}
          </div>

          <div style={{ display: "flex", gap: 8 }}>
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && sendMessage()}
              placeholder="输入消息，回车发送"
              style={{
                flex: 1,
                padding: "10px 12px",
                border: "1px solid #ddd",
                borderRadius: 8
              }}
            />
            <button
              onClick={sendMessage}
              disabled={!connected || !input.trim()}
              style={{
                padding: "10px 12px",
                borderRadius: 8,
                background: (!connected || !input.trim()) ? "#ccc" : "#3b82f6",
                color: "white",
                border: "none",
                cursor: (!connected || !input.trim()) ? "not-allowed" : "pointer"
              }}
            >
              发送
            </button>
          </div>
        </section>

        <section style={{ display: "grid", gap: 8 }}>
          <h2 style={{ fontSize: 16, fontWeight: 600 }}>在线成员</h2>
          <pre style={{
            margin: 0,
            background: "#f9fafb",
            padding: 12,
            borderRadius: 8,
            border: "1px solid #eee",
            maxHeight: 150,
            overflowY: "auto"
          }}>
            {JSON.stringify(peers, null, 2)}
          </pre>
        </section>
      </main>
    </AuthGuard>
  );
}