"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";

export default function Header() {
	const router = useRouter();
	const [email, setEmail] = useState<string | null>(null);
	const [loading, setLoading] = useState(true);
	const [signingOut, setSigningOut] = useState(false);

	useEffect(() => {
		let mounted = true;
		const run = async () => {
			const { data } = await supabase.auth.getUser();
			if (!mounted) return;
			setEmail(data.user?.email ?? null);
			setLoading(false);
		};
		run();
		const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
			setEmail(session?.user?.email ?? null);
		});
		return () => {
			sub.subscription.unsubscribe();
			mounted = false;
		};
	}, []);

	const onSignOut = async () => {
		setSigningOut(true);
		await supabase.auth.signOut();
		setSigningOut(false);
		router.replace("/login");
	};

	return (
		<header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px", borderBottom: "1px solid #eee" }}>
			<nav style={{ display: "flex", gap: 12 }}>
				<Link href="/">首页</Link>
				<Link href="/upload">上传文件</Link>
				<Link href="/realtime">聊天室</Link>
			</nav>
			<div>
				{loading ? (
					<span>...</span>
				) : email ? (
					<div style={{ display: "flex", gap: 12, alignItems: "center" }}>
						<span style={{ color: "#555" }}>{email}</span>
						<button
							onClick={onSignOut}
							disabled={signingOut}
							style={{
								padding: "6px 10px",
								borderRadius: 6,
								background: signingOut ? "#ccc" : "black",
								color: "white",
								border: "none",
								cursor: signingOut ? "not-allowed" : "pointer"
							}}
						>
							{signingOut ? "退出中..." : "退出登录"}
						</button>
					</div>
				) : (
					<div style={{ display: "flex", gap: 12 }}>
						<Link href="/login">登录</Link>
						<Link href="/signup">注册</Link>
					</div>
				)}
			</div>
		</header>
	);
}

