import { Suspense } from "react";
import DesignerApp from "@/components/DesignerApp";

export default function HomePage() {
  return (
    <Suspense fallback={<div className="designer-page" />}>
      <DesignerApp />
    </Suspense>
  );
}
