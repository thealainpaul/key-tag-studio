"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import AdminDesignEditor from "@/components/AdminDesignEditor";
import type { DesignPayload } from "@/lib/design";

export default function AdminDesignEditPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [payload, setPayload] = useState<DesignPayload | null>(null);
  const [status, setStatus] = useState("");

  useEffect(() => {
    fetch(`/api/admin/designs/${id}`)
      .then(async (res) => {
        if (res.status === 401) {
          router.push("/admin/login");
          return null;
        }
        return res.json();
      })
      .then((data) => {
        if (!data?.design) return;
        const raw = typeof data.design.designJson === "string" ? JSON.parse(data.design.designJson) : data.design.designJson;
        setPayload(raw);
        setStatus(data.design.status);
      });
  }, [id, router]);

  if (!payload) return <div className="container"><p className="muted">Loading…</p></div>;

  return <AdminDesignEditor designId={id} initialPayload={payload} initialStatus={status} />;
}
