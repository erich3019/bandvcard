"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { createContact, SessionExpiredError, uploadPhoto } from "@/lib/api";
import { prepareImage } from "@/lib/image";
import { recognizeText } from "@/lib/ocr";
import { type CardFields, emptyCardFields, parseCard } from "@/lib/parse-card";

type Step = "start" | "reading" | "review" | "saving" | "saved";

const inputs: { name: keyof CardFields; label: string; type?: string; wide?: boolean; autoComplete?: string }[] = [
  { name: "salutation", label: "Anrede" },
  { name: "function", label: "Funktion" },
  { name: "firstName", label: "Vorname" },
  { name: "lastName", label: "Nachname" },
  { name: "companyName", label: "Firmenname", wide: true },
  { name: "street", label: "Straße" },
  { name: "houseNumber", label: "Straßennummer" },
  { name: "postalCode", label: "Postleitzahl" },
  { name: "city", label: "Ort" },
  { name: "phone", label: "Telefon", type: "tel" },
  { name: "email", label: "E-Mail", type: "email" },
];

function message(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function CaptureForm() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("start");
  const [progress, setProgress] = useState(0);
  const [photo, setPhoto] = useState<Blob | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [ocrText, setOcrText] = useState("");
  const [fields, setFields] = useState<CardFields>(emptyCardFields);
  const [error, setError] = useState<string | null>(null);
  // Kept across a failed save, so a retry does not upload the photo twice.
  const photoLink = useRef<string | null>(null);

  function reset() {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }
    photoLink.current = null;
    setPhoto(null);
    setPreviewUrl(null);
    setOcrText("");
    setFields(emptyCardFields);
    setError(null);
    setProgress(0);
    setStep("start");
  }

  async function handlePhoto(file: File | undefined) {
    if (!file) {
      return;
    }
    reset();
    setStep("reading");
    try {
      const prepared = await prepareImage(file);
      setPhoto(prepared);
      setPreviewUrl(URL.createObjectURL(prepared));
      try {
        const text = await recognizeText(prepared, setProgress);
        setOcrText(text);
        setFields(parseCard(text));
      } catch (ocrError) {
        // The card can still be typed in by hand next to the photo.
        setError(`Die Texterkennung ist fehlgeschlagen: ${message(ocrError)}`);
      }
      setStep("review");
    } catch (imageError) {
      setError(message(imageError));
      setStep("start");
    }
  }

  async function handleSave(event: React.FormEvent) {
    event.preventDefault();
    if (!photo) {
      return;
    }
    setError(null);
    setStep("saving");
    try {
      photoLink.current ??= await uploadPhoto(photo);
      await createContact(fields, photoLink.current);
      setStep("saved");
    } catch (saveError) {
      if (saveError instanceof SessionExpiredError) {
        router.push("/login");
        return;
      }
      setError(`Speichern fehlgeschlagen: ${message(saveError)}`);
      setStep("review");
    }
  }

  const photoInput = (
    <label className="flex h-12 cursor-pointer items-center justify-center rounded-full bg-foreground px-6 font-medium text-background">
      {step === "start" ? "Visitenkarte fotografieren" : "Anderes Foto"}
      {/* capture opens the rear camera on phones; desktops fall back to a file picker. */}
      <input
        type="file"
        accept="image/*"
        capture="environment"
        className="sr-only"
        onChange={(event) => {
          void handlePhoto(event.target.files?.[0]);
          event.target.value = "";
        }}
      />
    </label>
  );

  const alert = error && (
    <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-800 dark:bg-red-950 dark:text-red-200">
      {error}
    </p>
  );

  if (step === "start") {
    return (
      <div className="flex flex-col items-center gap-4">
        {alert}
        <p className="text-center text-zinc-600 dark:text-zinc-400">
          Fotografieren Sie eine Visitenkarte. Der Text wird auf diesem Gerät erkannt und kann vor dem Speichern
          korrigiert werden.
        </p>
        {photoInput}
      </div>
    );
  }

  if (step === "saved") {
    return (
      <div className="flex flex-col items-center gap-4">
        <p role="status" className="text-lg">
          Kontakt gespeichert.
        </p>
        <button type="button" onClick={reset} className="h-12 rounded-full bg-foreground px-6 font-medium text-background">
          Weitere Visitenkarte erfassen
        </button>
      </div>
    );
  }

  const busy = step === "reading" || step === "saving";

  return (
    <div className="flex w-full flex-col gap-6">
      {alert}
      {previewUrl && (
        // eslint-disable-next-line @next/next/no-img-element -- local blob preview, nothing to optimise
        <img src={previewUrl} alt="Foto der Visitenkarte" className="max-h-72 w-full rounded-lg object-contain" />
      )}

      {step === "reading" ? (
        <div role="status" className="flex flex-col gap-2 text-zinc-600 dark:text-zinc-400">
          <span>Text wird erkannt …</span>
          <progress value={progress} max={1} className="w-full" />
        </div>
      ) : (
        <form onSubmit={handleSave} className="flex flex-col gap-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {inputs.map(({ name, label, type, wide }) => (
              <label key={name} className={`flex flex-col gap-1 text-sm ${wide ? "sm:col-span-2" : ""}`}>
                {label}
                <input
                  type={type ?? "text"}
                  value={fields[name]}
                  disabled={busy}
                  onChange={(event) => setFields({ ...fields, [name]: event.target.value })}
                  className="rounded-lg border border-black/15 bg-white px-3 py-2 text-base dark:border-white/20 dark:bg-zinc-900"
                />
              </label>
            ))}
          </div>

          {ocrText && (
            <details className="text-sm text-zinc-600 dark:text-zinc-400">
              <summary className="cursor-pointer">Erkannter Text</summary>
              <pre className="mt-2 whitespace-pre-wrap rounded-lg bg-black/5 p-3 dark:bg-white/10">{ocrText}</pre>
            </details>
          )}

          <div className="flex flex-wrap items-center gap-4">
            <button
              type="submit"
              disabled={busy}
              className="h-12 rounded-full bg-foreground px-6 font-medium text-background disabled:opacity-50"
            >
              {step === "saving" ? "Speichert …" : "Kontakt speichern"}
            </button>
            {!busy && photoInput}
          </div>
        </form>
      )}
    </div>
  );
}
