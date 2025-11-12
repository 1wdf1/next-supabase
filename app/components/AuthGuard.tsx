"use client";
import { ReactNode, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function AuthGuard({ children }: { children: ReactNode }) {
	const router = useRouter();
	const [checking, setChecking] = useState(true);
	const [authed, setAuthed] = useState(false);

	useEffect(() => {
		let mounted = true;
		const run = async () => {
			const { data } = await supabase.auth.getSession();
			if (!mounted) return;
			if (data.session) {
				setAuthed(true);
			} else {
				router.replace("/login");
			}
			setChecking(false);
		};
		run();
		return () => {
			mounted = false;
		};
	}, [router]);

	if (checking) {
		return (
			<div style={{ padding: 24, textAlign: "center" }}>
				正在验证登录状态...
			</div>
		);
	}
	if (!authed) return null;
	return <>{children}</>;
}

