"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import AuthGuard from "@/app/components/AuthGuard";

export default function AvatarUploadPage() {
	const bucketName = process.env.NEXT_PUBLIC_SUPABASE_AVATAR_BUCKET || "avatars";
	const [file, setFile] = useState<File | null>(null);
	const [uploading, setUploading] = useState(false);
	const [message, setMessage] = useState<string | null>(null);
	const [errorMsg, setErrorMsg] = useState<string | null>(null);
	const [previewUrl, setPreviewUrl] = useState<string | null>(null); // 头像预览
	const [email, setEmail] = useState<string | null>(null);
	const [currentAvatar, setCurrentAvatar] = useState<string | null>(null); // 当前头像

	// 获取用户信息及当前头像
	useEffect(() => {
		const fetchUser = async () => {
			const { data } = await supabase.auth.getUser();
			if (data.user) {
				setEmail(data.user.email ?? null);
				setCurrentAvatar(data.user.user_metadata?.avatar_url ?? null); // 从用户元数据获取头像
			}
		};
		fetchUser();
	}, []);

	// 处理文件选择：限制图片类型
	const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		const selectedFile = e.target.files?.[0] ?? null;
		if (!selectedFile) {
			setFile(null);
			setPreviewUrl(null);
			return;
		}

		// 限制只能上传图片（jpeg、png、webp）
		const allowedTypes = ["image/jpeg", "image/png", "image/webp"];
		if (!allowedTypes.includes(selectedFile.type)) {
			setErrorMsg("请上传 JPG、PNG 或 WebP 格式的图片");
			setFile(null);
			setPreviewUrl(null);
			return;
		}

		// 限制文件大小（例如 5MB）
		const maxSize = 5 * 1024 * 1024; // 5MB
		if (selectedFile.size > maxSize) {
			setErrorMsg("图片大小不能超过 5MB");
			setFile(null);
			setPreviewUrl(null);
			return;
		}

		// 生成预览图
		const reader = new FileReader();
		reader.onload = (event) => {
			setPreviewUrl(event.target?.result as string);
		};
		reader.readAsDataURL(selectedFile);

		setFile(selectedFile);
		setErrorMsg(null);
	};

	// 上传头像并更新用户信息
	const uploadAvatar = async () => {
		if (!file) return;
		if (!bucketName) {
			setErrorMsg("未配置头像存储桶，请设置 NEXT_PUBLIC_SUPABASE_AVATAR_BUCKET");
			return;
		}

		setUploading(true);
		setMessage("上传中，请稍候...");
		setErrorMsg(null);

		try {
			// 1. 确认用户已登录
			const { data: userData } = await supabase.auth.getUser();
			const user = userData.user;
			if (!user) throw new Error("用户未登录");
			const userId = user.id;

			// 2. 上传图片到 Supabase Storage
			// 生成安全的文件名（用户ID + 时间戳 + 原扩展名）
			const fileExt = file.name.split(".").pop()?.toLowerCase() || "png";
			const fileName = `${userId}/${Date.now()}.${fileExt}`;

			const { error: uploadError } = await supabase.storage
				.from(bucketName)
				.upload(fileName, file, {
					cacheControl: "3600", // 缓存1小时
					upsert: true, // 允许覆盖同用户的旧头像
					contentType: file.type || "image/png"
				});

			if (uploadError) throw uploadError;

			// 3. 获取图片公共URL
			const { data: urlData } = supabase.storage
				.from(bucketName)
				.getPublicUrl(fileName);
			const avatarUrl = urlData.publicUrl;

			// 4. 更新用户元数据（将头像URL存入用户信息）
			const { error: updateError } = await supabase.auth.updateUser({
				data: { avatar_url: avatarUrl } // 存入 user_metadata.avatar_url
			});

			if (updateError) throw updateError;

			// 5. 更新本地状态
			setMessage("头像更新成功！");
			setPreviewUrl(avatarUrl);
			setCurrentAvatar(avatarUrl);
			setFile(null);

		} catch (err: any) {
			const baseMsg = err.message || "上传失败";
			const extraInfo = [err.name, err.status, err.code].filter(Boolean).join(" / ");
			const fullMsg = extraInfo ? `${baseMsg} (${extraInfo})` : baseMsg;

			// 特殊处理：存储桶不存在
			if (fullMsg.toLowerCase().includes("bucket") && fullMsg.toLowerCase().includes("not found")) {
				setErrorMsg(`存储桶不存在，请在 Supabase 控制台创建存储桶：${bucketName}`);
			} else {
				setErrorMsg(fullMsg);
			}
		} finally {
			setUploading(false);
		}
	};

	return (
		<AuthGuard>
			<main style={{ maxWidth: 640, margin: "48px auto", padding: 16 }}>
				<h1 style={{ fontSize: 24, fontWeight: 600, marginBottom: 16 }}>
					更换头像
				</h1>
				<p style={{ marginBottom: 16, color: "#555" }}>
					{email ? `当前用户：${email}` : "正在加载用户信息..."}
				</p>

				{/* 当前头像预览 */}
				<div style={{ marginBottom: 24 }}>
					<h3 style={{ fontSize: 16, marginBottom: 8 }}>当前头像</h3>
					<div
						style={{
							width: 120,
							height: 120,
							borderRadius: "50%",
							overflow: "hidden",
							border: "2px solid #eee"
						}}
					>
						{currentAvatar ? (
							<img
								src={currentAvatar}
								alt="当前头像"
								style={{ width: "100%", height: "100%", objectFit: "cover" }}
							/>
						) : (
							<div style={{
								width: "100%",
								height: "100%",
								background: "#f0f0f0",
								display: "flex",
								alignItems: "center",
								justifyContent: "center",
								color: "#999"
							}}>
								暂无头像
							</div>
						)}
					</div>
				</div>

				{/* 上传区域 */}
				<div style={{ display: "grid", gap: 12 }}>
					<div>
						<label style={{ fontSize: 14, color: "#666", marginBottom: 8, display: "block" }}>
							选择图片（支持 JPG、PNG、WebP，最大 5MB）
						</label>
						<input
							type="file"
							accept="image/jpeg, image/png, image/webp" // 仅显示图片文件
							onChange={handleFileChange}
							disabled={uploading}
							style={{ padding: 8 }}
						/>
					</div>

					{/* 选中的图片预览 */}
					{previewUrl && (
						<div>
							<h3 style={{ fontSize: 16, marginBottom: 8 }}>预览</h3>
							<img
								src={previewUrl}
								alt="预览"
								style={{
									maxWidth: 200,
									maxHeight: 200,
									border: "1px solid #eee",
									borderRadius: 8
								}}
							/>
						</div>
					)}

					<button
						onClick={uploadAvatar}
						disabled={!file || uploading}
						style={{
							padding: "10px 12px",
							borderRadius: 8,
							background: uploading ? "#ccc" : "black",
							color: "white",
							border: "none",
							cursor: (!file || uploading) ? "not-allowed" : "pointer",
							width: "fit-content"
						}}
					>
						{uploading ? "上传中..." : "确认上传"}
					</button>

					{message && <p style={{ color: "#16a34a", margin: 0 }}>{message}</p>}
					{errorMsg && <p style={{ color: "#dc2626", margin: 0 }}>{errorMsg}</p>}

					<p style={{ fontSize: 12, color: "#666", margin: 0 }}>
						存储桶配置：<code>{bucketName}</code>（需在 Supabase 控制台提前创建并设置权限）
					</p>
				</div>
			</main>
		</AuthGuard>
	);
}