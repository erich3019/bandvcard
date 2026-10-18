"use client";

import { Camera, Keyboard, Mic, RotateCcw } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { ContactFields } from "@/components/contact-fields";
import { buttonClass, ErrorNote, Panel } from "@/components/ui";
import { createContact, SessionExpiredError, uploadPhoto } from "@/lib/api";
import { prepareImage, prepareOcrImage } from "@/lib/image";
import { recognizeText } from "@/lib/ocr";
import { type CardFields, emptyCardFields, parseCard } from "@/lib/parse-card";
import { parseSpokenContact } from "@/lib/parse-spoken";
import { useDictation } from "@/lib/use-dictation";

type Step = "start" | "dictating" | "reading" | "review" | "saving" | "saved";

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

  const photoInput = (primary: boolean) => (
    <label className={`${buttonClass(primary ? "primary" : "secondary")} cursor-pointer has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-focus-ring`}>
      <Camera aria-hidden="true" />
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

  const alert = error && <ErrorNote>{error}</ErrorNote>;

  if (step === "start") {
    return (
      <div className="flex flex-col gap-6">
        {alert}
        <Panel title="Wie möchten Sie den Kontakt erfassen?" sub="Die erkannten Angaben können Sie vor dem Speichern korrigieren.">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="flex flex-col gap-3 rounded-lg border border-border p-3.5">
              <span className="inline-flex size-8 items-center justify-center rounded-md bg-primary-tint-08 text-primary">
                <Camera aria-hidden="true" className="size-4" />
              </span>
              <div className="flex-1">
                <p className="text-sm font-semibold">Foto der Karte</p>
                <p className="text-xs text-muted">Der Text wird auf diesem Gerät erkannt, das Foto beim Kontakt abgelegt.</p>
              </div>
              {photoInput(true)}
            </div>
            <div className="flex flex-col gap-3 rounded-lg border border-border p-3.5">
              <span className="inline-flex size-8 items-center justify-center rounded-md bg-primary-tint-08 text-primary">
                <Mic aria-hidden="true" className="size-4" />
              </span>
              <div className="flex-1">
                <p className="text-sm font-semibold">Diktieren</p>
                <p className="text-xs text-muted">Sie nennen jeweils das Feld und dann den Wert.</p>
              </div>
              <button type="button" onClick={startDictation} className={buttonClass("secondary")}>
                <Mic aria-hidden="true" />
                Kontakt diktieren
              </button>
            </div>
            <div className="flex flex-col gap-3 rounded-lg border border-border p-3.5">
              <span className="inline-flex size-8 items-center justify-center rounded-md bg-primary-tint-08 text-primary">
                <Keyboard aria-hidden="true" className="size-4" />
              </span>
              <div className="flex-1">
                <p className="text-sm font-semibold">Von Hand</p>
                <p className="text-xs text-muted">Ohne Karte, direkt im Formular.</p>
              </div>
              <button type="button" onClick={() => setStep("review")} className={buttonClass("secondary")}>
                <Keyboard aria-hidden="true" />
                Von Hand erfassen
              </button>
            </div>
          </div>
        </Panel>
      </div>
    );
  }

  if (step === "dictating") {
    return (
      <div className="flex flex-col gap-6">
        {alert}
        <Panel
          title="Kontakt diktieren"
          sub="Nennen Sie jeweils das Feld und dann den Wert, zum Beispiel: «Vorname Andreas, Nachname Gasser, Firma Aberegg Consulting AG, Ort Bern»."
        >
          <div className="flex flex-col gap-4">
            <p className="text-xs text-muted">
              Felder: Anrede, Vorname, Nachname, Firma, Funktion, Strasse, Postleitzahl, Ort, Telefon, Mobil, E-Mail
            </p>
            <p role="status" className="min-h-24 rounded-md border border-input bg-surface p-3 text-ink-secondary">
              {spoken}{" "}
              <span className="text-muted">
                {dictation.interim || (dictation.listening ? (spoken ? "…" : "Sprechen Sie jetzt …") : "")}
              </span>
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={finishDictation}
                disabled={!spoken && !dictation.interim}
                className={buttonClass("primary")}
              >
                Ins Formular übernehmen
              </button>
              {!dictation.listening && (
                <button type="button" onClick={startDictation} className={buttonClass("secondary")}>
                  <RotateCcw aria-hidden="true" />
                  Neu diktieren
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  dictation.stop();
                  reset();
                }}
                className={buttonClass("ghost")}
              >
                Abbrechen
              </button>
            </div>
          </div>
        </Panel>
      </div>
    );
  }

  if (step === "saved") {
    return (
      <Panel>
        <div className="flex flex-col items-start gap-4">
          <p role="status" className="rounded-md bg-success-bg px-3 py-2 font-medium text-success-strong">
            Kontakt gespeichert.
          </p>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={reset} className={buttonClass("primary")}>
              Weiteren Kontakt erfassen
            </button>
            {savedId && (
              <Link href={`/kontakte/${savedId}`} className={buttonClass("secondary")}>
                Kontakt ansehen
              </Link>
            )}
          </div>
        </div>
      </Panel>
    );
  }

  const busy = step === "reading" || step === "saving";
  const hasRail = Boolean(previewUrl || sourceText);

  return (
    <div className="flex flex-col gap-6">
      {alert}
      <div className={`grid grid-cols-1 gap-5 ${hasRail ? "xl:grid-cols-12" : ""}`}>
        {hasRail && (
          // First on phones, so the photo is visible above the form; on wide screens the right column.
          <div className="flex flex-col gap-5 xl:order-2 xl:col-span-4">
            {previewUrl && (
              <Panel title="Foto" variant="rail">
                {/* eslint-disable-next-line @next/next/no-img-element -- local blob preview, nothing to optimise */}
                <img src={previewUrl} alt="Foto der Visitenkarte" className="max-h-72 w-full rounded-md object-contain" />
              </Panel>
            )}
            {sourceText && (
              <Panel title="Erkannter Text" sub="Grundlage der Felder, zum Vergleichen." variant="rail">
                <pre className="max-h-64 overflow-auto rounded-md bg-page p-3 font-mono text-xs whitespace-pre-wrap text-ink-secondary">
                  {sourceText}
                </pre>
              </Panel>
            )}
          </div>
        )}

        <div className={hasRail ? "xl:col-span-8" : ""}>
          <Panel
            title="Angaben prüfen"
            sub={step === "reading" ? undefined : "Korrigieren Sie die Felder bei Bedarf und speichern Sie den Kontakt."}
          >
            {step === "reading" ? (
              <div role="status" className="flex flex-col gap-2 text-muted">
                <span>Text wird erkannt …</span>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-divider">
                  <div className="h-full rounded-full bg-primary" style={{ width: `${Math.round(progress * 100)}%` }} />
                </div>
              </div>
            ) : (
              <form onSubmit={handleSave} className="flex flex-col gap-6">
                <ContactFields fields={fields} disabled={busy} onChange={setFields} />
                <div className="flex flex-wrap items-center gap-2 border-t border-divider pt-5">
                  <button type="submit" disabled={busy} className={buttonClass("primary")}>
                    {step === "saving" ? "Speichert …" : "Kontakt speichern"}
                  </button>
                  {!busy && photo && photoInput(false)}
                  {!busy && (
                    <button type="button" onClick={reset} className={buttonClass("ghost")}>
                      Verwerfen
                    </button>
                  )}
                </div>
              </form>
            )}
          </Panel>
        </div>
      </div>
    </div>
  );
}
