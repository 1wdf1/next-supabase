"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import AuthGuard from "@/app/components/AuthGuard";

export default function UploadPage() {
	const bucketName = process.env.NEXT_PUBLIC_SUPABASE_BUCKET || "uploads";
	const [file, setFile] = useState<File | null>(null);
	const [uploading, setUploading] = useState(false);
	const [message, setMessage] = useState<string | null>(null);
	const [errorMsg, setErrorMsg] = useState<string | null>(null);
	const [publicUrl, setPublicUrl] = useState<string | null>(null);
	const [email, setEmail] = useState<string | null>(null);

	useEffect(() => {
		const run = async () => {
			const { data } = await supabase.auth.getUser();
			setEmail(data.user?.email ?? null);
		};
		run();
	}, []);

	const onUpload = async () => {
		if (!file) return;
		if (!bucketName) {
			setErrorMsg("未配置存储桶名称，请设置 NEXT_PUBLIC_SUPABASE_BUCKET 或使用默认 uploads。");
			return;
		}
		setUploading(true);
		setMessage("上传中，请稍候...");
		setErrorMsg(null);
		setPublicUrl(null);
		try {
			const userRes = await supabase.auth.getUser();
			const userId = userRes.data.user?.id;
			if (!userId) {
				throw new Error("用户未登录");
			}
			// 目标存储桶名称（需在 Supabase Storage 预先创建）
			const bucket = bucketName;
			// 安全处理文件名，避免因特殊字符导致 InvalidKey
			const safeName = file.name
				.replace(/\s+/g, "_")
				.replace(/[^\w.\-]/g, "_")
				.slice(0, 180); // 保守限制长度，避免过长 key
			const filePath = `${userId}/${Date.now()}-${safeName}`;
			const { error: upErr } = await supabase.storage.from(bucket).upload(filePath, file, {
				cacheControl: "3600",
				upsert: false,
				contentType: file.type || "application/octet-stream"
			});
			if (upErr) throw upErr;
			const { data } = supabase.storage.from(bucket).getPublicUrl(filePath);
			setPublicUrl(data.publicUrl);
			setMessage("上传成功！");
		} catch (err: any) {
			const raw = err?.message ?? "上传失败";
			// 附加更多错误信息，帮助排查（名称/状态）
			const extra = [err?.name, err?.status, err?.code].filter(Boolean).join(" / ");
			if (typeof raw === "string" && raw.toLowerCase().includes("bucket") && raw.toLowerCase().includes("not")) {
				setErrorMsg(`存储桶不存在：${bucketName}。请先在 Supabase 控制台创建该存储桶，或在环境变量中设置 NEXT_PUBLIC_SUPABASE_BUCKET。`);
			} else {
				setErrorMsg(extra ? `${raw} (${extra})` : raw);
			}
		} finally {
			setUploading(false);
		}
	};

	return (
		<AuthGuard>
			<main style={{ maxWidth: 640, margin: "48px auto", padding: 16 }}>
				<h1 style={{ fontSize: 24, fontWeight: 600, marginBottom: 16 }}>
					文件上传
				</h1>
				<p style={{ marginBottom: 16, color: "#555" }}>
					{email ? `已登录：${email}` : "正在获取用户信息..."}
				</p>
				<p style={{ marginBottom: 12, fontSize: 12, color: "#666" }}>
					当前存储桶：<code>{bucketName}</code>
				</p>
				<div style={{ display: "grid", gap: 12 }}>
					<input
						type="file"
						onChange={(e) => setFile(e.target.files?.[0] ?? null)}
						disabled={uploading}
					/>
					<button
						onClick={onUpload}
						disabled={!file || uploading}
						style={{
							padding: "10px 12px",
							borderRadius: 8,
							background: uploading ? "#ccc" : "black",
							color: "white",
							border: "none",
							cursor: !file || uploading ? "not-allowed" : "pointer"
						}}
					>
						{uploading ? "上传中..." : "上传"}
					</button>
					{message ? <p style={{ color: "#16a34a" }}>{message}</p> : null}
					{errorMsg ? <p style={{ color: "#dc2626" }}>{errorMsg}</p> : null}
					{publicUrl ? (
						<p>
							文件地址：
							<a href={publicUrl} target="_blank" rel="noreferrer" style={{ color: "#2563eb", textDecoration: "underline" }}>
								{publicUrl}
							</a>
						</p>
					) : null}
				</div>
			</main>
		</AuthGuard>
	);
}

