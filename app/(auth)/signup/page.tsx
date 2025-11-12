"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function SignupPage() {
	const router = useRouter();
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [submitting, setSubmitting] = useState(false);
	const [message, setMessage] = useState<string | null>(null);
	const [errorMsg, setErrorMsg] = useState<string | null>(null);

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		setSubmitting(true);
		setMessage(null);
		setErrorMsg(null);
		const { error } = await supabase.auth.signUp({ email, password });
		setSubmitting(false);
		if (error) {
			setErrorMsg(error.message);
			return;
		}
		setMessage("注册成功。现在可以使用该账号登录。");
		// 轻微延迟后跳到登录
		setTimeout(() => router.replace("/login"), 800);
	};

	return (
		<main style={{ maxWidth: 420, margin: "48px auto", padding: 16 }}>
			<h1 style={{ fontSize: 24, fontWeight: 600, marginBottom: 16 }}>注册</h1>
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
						placeholder="至少 6 位"
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
					{submitting ? "注册中..." : "注册"}
				</button>
				<a href="/login" style={{ color: "#2563eb", textDecoration: "underline", marginTop: 8 }}>
					已有账号？去登录
				</a>
				{message ? <p style={{ color: "#16a34a" }}>{message}</p> : null}
				{errorMsg ? <p style={{ color: "#dc2626" }}>{errorMsg}</p> : null}
			</form>
		</main>
	);
}

