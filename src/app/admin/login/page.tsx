"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function AdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();
    if (!data.success) {
      setError(data.error || "Login failed");
      return;
    }
    router.push("/admin/designs");
  }

  return (
    <div className="container" style={{ maxWidth: 480 }}>
      <div className="nav"><Link href="/">Key Tag Studio</Link></div>
      <div className="card">
        <h3>Admin Login</h3>
        <form onSubmit={onSubmit}>
          <div className="field"><label>Email</label><input type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required /></div>
          <div className="field"><label>Password</label><input type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required /></div>
          {error && <p style={{ color: "var(--danger)" }}>{error}</p>}
          <button className="btn" type="submit">Login</button>
        </form>
      </div>
    </div>
  );
}
