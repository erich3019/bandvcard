import type { Metadata } from "next";
import { PageShell } from "@/components/page-shell";
import { CaptureForm } from "./capture-form";

export const metadata: Metadata = { title: "Visitenkarte erfassen – bandvcard" };

export default function CapturePage() {
  return (
    <PageShell title="Visitenkarte erfassen">
      <CaptureForm />
    </PageShell>
  );
}
