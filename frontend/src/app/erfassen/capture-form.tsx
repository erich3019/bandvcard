"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { ContactFields } from "@/components/contact-fields";
import { createContact, SessionExpiredError, uploadPhoto } from "@/lib/api";
import { prepareImage, prepareOcrImage } from "@/lib/image";
import { recognizeText } from "@/lib/ocr";
import { type CardFields, emptyCardFields, parseCard } from "@/lib/parse-card";
import { parseSpokenContact } from "@/lib/parse-spoken";
import { useDictation } from "@/lib/use-dictation";

type Step = "start" | "dictating" | "reading" | "review" | "saving" | "saved";

const secondaryButton =
  "flex h-12 items-center justify-center rounded-full border border-black/10 px-6 font-medium dark:border-white/20";

function message(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function CaptureForm() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("start");
  const [progress, setProgress] = useState(0);
  const [photo, setPhoto] = useState<Blob | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  // The text the fields were filled from: read from the card or dictated.
  const [sourceText, setSourceText] = useState("");
  const [spoken, setSpoken] = useState("");
  const [fields, setFields] = useState<CardFields>(emptyCardFields);
  const [error, setError] = useState<string | null>(null);
  const dictation = useDictation(setError);
  // The dictated text as it grows; the state above is its copy for display.
  const spokenText = useRef("");
  const [savedId, setSavedId] = useState<string | null>(null);
  // Kept across a failed save, so a retry does not upload the photo twice.
  const photoLink = useRef<string | null>(null);

  function reset() {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }
    photoLink.current = null;
    setSavedId(null);
    setPhoto(null);
    setPreviewUrl(null);
    setSourceText("");
    spokenText.current = "";
    setSpoken("");
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
        const text = await recognizeText(await prepareOcrImage(prepared), setProgress);
        setSourceText(text);
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

  function startDictation() {
    reset();
    setStep("dictating");
    // Keeps listening across pauses until the user is done.
    dictation.start(
      (text) => {
        spokenText.current = `${spokenText.current} ${text}`.trim();
        setSpoken(spokenText.current);
      },
      { continuous: true },
    );
  }

  function finishDictation() {
    // Wait for the recogniser to hand over the last words before reading the text.
    dictation.stop(() => {
      setSourceText(spokenText.current);
      setFields(parseSpokenContact(spokenText.current));
      setStep("review");
    });
  }

  async function handleSave(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setStep("saving");
    try {
      // A dictated or typed contact has no photo.
      if (photo) {
        photoLink.current ??= await uploadPhoto(photo);
      }
      setSavedId(await createContact(fields, photoLink.current ?? ""));
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
          Fotografieren Sie eine Visitenkarte oder diktieren Sie den Kontakt. Die erkannten Angaben können vor dem
          Speichern korrigiert werden.
        </p>
        {photoInput}
        <button type="button" onClick={startDictation} className={secondaryButton}>
          Kontakt diktieren
        </button>
        <button type="button" onClick={() => setStep("review")} className="text-sm underline">
          Ohne Karte von Hand erfassen
        </button>
      </div>
    );
  }

  if (step === "dictating") {
    return (
      <div className="flex w-full flex-col gap-4">
        {alert}
        <p className="text-zinc-600 dark:text-zinc-400">
          Nennen Sie jeweils das Feld und dann den Wert, zum Beispiel: „Vorname Andreas, Nachname Gasser, Firma
          Aberegg Consulting AG, Ort Bern“.
        </p>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Felder: Anrede, Vorname, Nachname, Firma, Funktion, Straße, Postleitzahl, Ort, Telefon, Mobil, E-Mail
        </p>
        <p role="status" className="min-h-24 rounded-lg border border-black/10 p-3 dark:border-white/15">
          {spoken}{" "}
          <span className="text-zinc-500">
            {dictation.interim || (dictation.listening ? (spoken ? "…" : "Sprechen Sie jetzt …") : "")}
          </span>
        </p>
        <div className="flex flex-wrap gap-4">
          <button
            type="button"
            onClick={finishDictation}
            disabled={!spoken && !dictation.interim}
            className="h-12 rounded-full bg-foreground px-6 font-medium text-background disabled:opacity-50"
          >
            Übernehmen
          </button>
          {!dictation.listening && (
            <button type="button" onClick={startDictation} className={secondaryButton}>
              Neu diktieren
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              dictation.stop();
              reset();
            }}
            className="h-12 px-2 underline"
          >
            Abbrechen
          </button>
        </div>
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
          Weiteren Kontakt erfassen
        </button>
        {savedId && (
          <Link href={`/kontakte/${savedId}`} className="underline">
            Kontakt ansehen
          </Link>
        )}
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
          <ContactFields fields={fields} disabled={busy} onChange={setFields} />

          {sourceText && (
            <details className="text-sm text-zinc-600 dark:text-zinc-400">
              <summary className="cursor-pointer">Erkannter Text</summary>
              <pre className="mt-2 whitespace-pre-wrap rounded-lg bg-black/5 p-3 dark:bg-white/10">{sourceText}</pre>
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
            {!busy && photo && photoInput}
            {!busy && (
              <button type="button" onClick={reset} className="h-12 px-2 underline">
                Verwerfen
              </button>
            )}
          </div>
        </form>
      )}
    </div>
  );
}
