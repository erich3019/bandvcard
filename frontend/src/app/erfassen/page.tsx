import type { Metadata } from "next";
import { PageShell } from "@/components/page-shell";
import { PageHeader } from "@/components/ui";
import { CaptureForm } from "./capture-form";

export const metadata: Metadata = { title: "Visitenkarte erfassen – bandvcard" };

export default function CapturePage() {
  return (
    <PageShell crumbs={[{ label: "Start", href: "/" }, { label: "Visitenkarte erfassen" }]}>
      <PageHeader
        title="Visitenkarte erfassen"
        lead="Fotografieren, diktieren oder von Hand eingeben, dann prüfen und speichern."
      />
      <CaptureForm />
    </PageShell>
  );
}
