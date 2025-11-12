"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";

export default function Header() {
  const router = useRouter();
  const [email, setEmail] = useState<string | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null); // 头像URL
  const [loading, setLoading] = useState(true);
  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => {
    let mounted = true;
    
    // 获取当前用户信息（含头像）
    const fetchUser = async () => {
      const { data } = await supabase.auth.getUser();
      if (!mounted) return;
      
      if (data.user) {
        setEmail(data.user.email ?? null);
        // 从用户元数据中获取头像（对应上传时存入的 avatar_url）
        setAvatarUrl(data.user.user_metadata?.avatar_url ?? null);
      }
      setLoading(false);
    };
    
    fetchUser();
    
    // 监听认证状态变化（如登录/登出/头像更新时）
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        setEmail(session.user.email ?? null);
        setAvatarUrl(session.user.user_metadata?.avatar_url ?? null);
      } else {
        setEmail(null);
        setAvatarUrl(null);
      }
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
    <header style={{ 
      display: "flex", 
      alignItems: "center", 
      justifyContent: "space-between", 
      padding: "12px 16px", 
      borderBottom: "1px solid #eee" 
    }}>
      <nav style={{ display: "flex", gap: 12 }}>
        <Link href="/">首页</Link>
        <Link href="/upload">更换头像</Link>
        <Link href="/realtime">聊天室</Link>
      </nav>
      
      <div>
        {loading ? (
          <span>加载中...</span>
        ) : email ? (
          <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
            {/* 头像显示区域 */}
            <div style={{
              width: 36,
              height: 36,
              borderRadius: "50%",
              overflow: "hidden",
              border: "1px solid #eee"
            }}>
              {avatarUrl ? (
                <img
                  src={avatarUrl}
                  alt="用户头像"
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
                  color: "#999",
                  fontSize: 12
                }}>
                  {email.charAt(0).toUpperCase()}
                </div>
              )}
            </div>
            
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