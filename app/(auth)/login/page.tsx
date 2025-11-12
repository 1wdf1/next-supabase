"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function LoginPage() {
	const router = useRouter();
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [submitting, setSubmitting] = useState(false);
	const [errorMsg, setErrorMsg] = useState<string | null>(null);

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		setSubmitting(true);
		setErrorMsg(null);
		const { error } = await supabase.auth.signInWithPassword({ email, password });
		setSubmitting(false);
		if (error) {
			setErrorMsg(error.message);
			return;
		}
		router.replace("/");
	};

	return (
		<main style={{ maxWidth: 420, margin: "48px auto", padding: 16 }}>
			<h1 style={{ fontSize: 24, fontWeight: 600, marginBottom: 16 }}>登录</h1>
			<form onSubmit={handleSubmit} style={{ display: "grid", gap: 12 }}>
				<label style={{ display: "grid", gap: 6 }}>
					<span>邮箱</span>
					<input
						type="email"
						required
						value={email}
						onChange={(e) => setEmail(e.target.value)}
						placeholder="you@example.com"
						style={{ padding: "10px 12px", border: "1px solid #ddd", borderRadius: 8 }}
					/>
				</label>
				<label style={{ display: "grid", gap: 6 }}>
					<span>密码</span>
					<input
						type="password"
						required
						value={password}
						onChange={(e) => setPassword(e.target.value)}
						placeholder="••••••••"
						style={{ padding: "10px 12px", border: "1px solid #ddd", borderRadius: 8 }}
					/>
				</label>
				<button
					type="submit"
					disabled={submitting}
					style={{
						padding: "10px 12px",
						borderRadius: 8,
						background: submitting ? "#ccc" : "black",
						color: "white",
						border: "none",
						cursor: submitting ? "not-allowed" : "pointer"
					}}
				>
					{submitting ? "登录中..." : "登录"}
				</button>
				<a href="/signup" style={{ color: "#2563eb", textDecoration: "underline", marginTop: 8 }}>
					没有账号？去注册
				</a>
				{errorMsg ? (
					<p style={{ color: "#dc2626" }}>{errorMsg}</p>
				) : null}
			</form>
		</main>
	);
}

