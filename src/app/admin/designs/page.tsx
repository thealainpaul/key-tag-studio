"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

type Design = {
  id: string;
  status: string;
  tagColor: string;
  previewDataUrl: string | null;
  rejectionReason: string | null;
  createdAt: string;
};

export default function AdminDesignsPage() {
  const router = useRouter();
  const [designs, setDesigns] = useState<Design[]>([]);
  const [error, setError] = useState("");
  const [reasons, setReasons] = useState<Record<string, string>>({});

  async function load() {
    const res = await fetch("/api/admin/designs");
    if (res.status === 401) {
      router.push("/admin/login");
      return;
    }
    const data = await res.json();
    setDesigns(data.designs || []);
  }

  useEffect(() => { load(); }, []);

  async function act(id: string, action: "approve" | "reject") {
    const res = await fetch(`/api/admin/designs/${id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, reason: reasons[id] }),
    });
    if (!res.ok) {
      setError("Action failed");
      return;
    }
    load();
  }

  async function remove(id: string) {
    await fetch(`/api/admin/designs/${id}`, { method: "DELETE" });
    load();
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/admin/login");
  }

  return (
    <div className="container">
      <div className="nav">
        <Link href="/"><strong>Key Tag Studio</strong></Link>
        <button className="btn secondary" onClick={logout}>Logout</button>
      </div>
      <div className="card">
        <h3>Submitted Designs</h3>
        <p className="muted">Review user layouts, approve for production, or request changes.</p>
        {error && <p style={{ color: "var(--danger)" }}>{error}</p>}
        <p className="muted">Showing {designs.length} designs</p>
        {designs.map((d, i) => (
          <div key={d.id} className="card" style={{ marginTop: "0.75rem" }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: "1rem", flexWrap: "wrap" }}>
              <div>
                <strong>#{designs.length - i}</strong> · <span className={`status-${d.status}`}>{d.status}</span>
                <div className="muted">{new Date(d.createdAt).toLocaleString()}</div>
                {d.rejectionReason && <div className="muted">Reason: {d.rejectionReason}</div>}
              </div>
              {d.previewDataUrl && <img src={d.previewDataUrl} alt="preview" style={{ width: 180, borderRadius: 8, border: "1px solid var(--border)" }} />}
            </div>
            {d.status === "pending" && (
              <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.75rem", flexWrap: "wrap" }}>
                <button className="btn success" onClick={() => act(d.id, "approve")}>✓ Approve</button>
                <input placeholder="Reason for rejection" value={reasons[d.id] || ""} onChange={(e) => setReasons((r) => ({ ...r, [d.id]: e.target.value }))} style={{ flex: 1, minWidth: 200 }} />
                <button className="btn danger" onClick={() => act(d.id, "reject")}>✕ Reject</button>
              </div>
            )}
            <button className="btn danger" style={{ marginTop: "0.5rem" }} onClick={() => remove(d.id)}>🗑️ Delete</button>
          </div>
        ))}
      </div>
    </div>
  );
}
