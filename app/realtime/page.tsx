"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import AuthGuard from "@/app/components/AuthGuard";

type ChatMessage = {
	id: string;
	userId: string;
	email: string | null;
	text: string;
	ts: number;
};

export default function RealtimeDemoPage() {
	const [email, setEmail] = useState<string | null>(null);
	const [userId, setUserId] = useState<string | null>(null);
	const [connected, setConnected] = useState(false);
	const [peers, setPeers] = useState<Record<string, Array<{ online_at: string }>>>({});
	const [messages, setMessages] = useState<ChatMessage[]>([]);
	const [input, setInput] = useState("");
	const listRef = useRef<HTMLDivElement | null>(null);

	// 兼容生成唯一 ID（优先使用 crypto.randomUUID）
	const generateId = () => {
		try {
			// @ts-ignore
			if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
				// @ts-ignore
				return crypto.randomUUID();
			}
		} catch { }
		// 退化方案：基于时间与随机数
		return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
	};

	// 简易滚动到底部
	useEffect(() => {
		listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
	}, [messages]);

	// 加载用户信息
	useEffect(() => {
		const run = async () => {
			const { data } = await supabase.auth.getUser();
			setEmail(data.user?.email ?? null);
			setUserId(data.user?.id ?? null);
		};
		run();
	}, []);

	const channelName = useMemo(() => "room_demo", []);

	useEffect(() => {
		if (!userId) return;
		// 创建频道：包含 Presence 和 Broadcast 两种能力
		const channel = supabase.channel(channelName, {
			config: { presence: { key: userId } }
		});

		// Presence: 同步时更新在线成员
		channel.on("presence", { event: "sync" }, () => {
			const state = channel.presenceState<{ online_at: string }>();
			setPeers(state);
		});
		// 订阅他人上线/下线（可选，用于提示）
		channel.on("presence", { event: "join" }, () => { });
		channel.on("presence", { event: "leave" }, () => { });

		// Broadcast: 接收消息
		channel.on("broadcast", { event: "message" }, ({ payload }) => {
			const msg = payload as ChatMessage;
			setMessages((prev) => [...prev, msg]);
		});

		// 订阅
		channel.subscribe((status) => {
			if (status === "SUBSCRIBED") {
				setConnected(true);
				// 上线发布 presence
				channel.track({ online_at: new Date().toISOString() });
			}
		});

		// 数据库变更订阅：获取其他客户端写入的历史消息
		const dbChannel = supabase
			.channel("db:messages")
			.on(
				"postgres_changes",
				{ event: "INSERT", schema: "public", table: "messages" },
				(payload) => {
					const row = payload.new as any;
					const msg = {
						id: row.id as string,
						userId: (row.user_id as string) || "",
						email: (row.email as string) ?? null,
						text: row.text as string,
						ts: new Date(row.created_at as string).getTime(),
					};
					setMessages((prev) => {
						if (prev.some((m) => m.id === msg.id)) return prev;
						return [...prev, msg];
					});
				}
			)
			.subscribe();

		return () => {
			setConnected(false);
			supabase.removeChannel(channel);
			supabase.removeChannel(dbChannel);
		};
	}, [channelName, userId]);

	// 在线人数（去重：按 userId）
	const onlineCount = useMemo(() => {
		return Object.keys(peers).length;
	}, [peers]);
	// 连接数（同一用户多标签页会叠加）
	const connectionCount = useMemo(() => {
		return Object.values(peers).reduce((acc, arr) => acc + arr.length, 0);
	}, [peers]);

	// 初次加载历史消息
	useEffect(() => {
		const loadHistory = async () => {
			const { data, error } = await supabase
				.from("messages")
				.select("*")
				.order("created_at", { ascending: false })
				.limit(5);
			if (!error && Array.isArray(data)) {
				setMessages(
					data.reverse().map((row: any) => ({
						id: row.id as string,
						userId: (row.user_id as string) || "",
						email: (row.email as string) ?? null,
						text: row.text as string,
						ts: new Date(row.created_at as string).getTime(),
					}))
				);
			}
		};
		loadHistory();
	}, []);

	const sendMessage = async () => {
		if (!connected || !userId) return;
		const text = input.trim();
		if (!text) return;
		const msg: ChatMessage = {
			id: generateId(),
			userId,
			email,
			text,
			ts: Date.now()
		};
		setInput("");
		// 发送广播消息
		await supabase.channel(channelName).send({
			type: "broadcast",
			event: "message",
			payload: msg
		});
		// 本地也立即显示
		// setMessages((prev) => [...prev, msg]);
		// 写入数据库（持久化）
		await supabase.from("messages").insert({
			// id: msg.id,
			user_id: userId,
			email,
			text: msg.text,
		});
	};

	return (
		<AuthGuard>
			<main style={{ maxWidth: 720, margin: "48px auto", padding: 16, display: "grid", gap: 16 }}>
				<h1 style={{ fontSize: 24, fontWeight: 600 }}>Realtime WebSocket 示例</h1>
				<p style={{ color: "#555" }}>
					当前用户：{email ?? "加载中..."}　|　连接状态：{connected ? "已连接" : "未连接"}　|　在线人数：{onlineCount}（连接数：{connectionCount}）
				</p>

				<section style={{ display: "grid", gap: 8 }}>
					<h2 style={{ fontSize: 16, fontWeight: 600 }}>群聊（Broadcast）</h2>
					<div
						ref={listRef}
						style={{
							border: "1px solid #e5e7eb",
							borderRadius: 8,
							height: 260,
							padding: 12,
							overflowY: "auto",
							background: "#fafafa"
						}}
					>
						{messages.map((m) => (
							<div key={m.id} style={{ marginBottom: 8 }}>
								<div style={{ fontSize: 12, color: "#6b7280" }}>
									{m.email ?? m.userId} · {new Date(m.ts).toLocaleTimeString()}
								</div>
								<div>{m.text}</div>
							</div>
						))}
						{messages.length === 0 ? <div style={{ color: "#9ca3af" }}>还没有消息，试着发一条吧</div> : null}
					</div>
					<div style={{ display: "flex", gap: 8 }}>
						<input
							value={input}
							onChange={(e) => setInput(e.target.value)}
							onKeyDown={(e) => {
								if (e.key === "Enter") sendMessage();
							}}
							placeholder="输入消息，回车发送"
							style={{ flex: 1, padding: "10px 12px", border: "1px solid #ddd", borderRadius: 8 }}
						/>
						<button
							onClick={sendMessage}
							disabled={!connected || !input.trim()}
							style={{
								padding: "10px 12px",
								borderRadius: 8,
								background: !connected || !input.trim() ? "#ccc" : "black",
								color: "white",
								border: "none",
								cursor: !connected || !input.trim() ? "not-allowed" : "pointer"
							}}
						>
							发送
						</button>
					</div>
				</section>

				<section style={{ display: "grid", gap: 8 }}>
					<h2 style={{ fontSize: 16, fontWeight: 600 }}>Presence 在线成员</h2>
					<pre style={{ margin: 0, background: "#f9fafb", padding: 12, borderRadius: 8, border: "1px solid #eee" }}>
						{JSON.stringify(peers, null, 2)}
					</pre>
				</section>
			</main>
		</AuthGuard>
	);
}

