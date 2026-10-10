// Dictation with the speech recognition built into the browser (Web Speech API).
// Chrome, Edge and Safari have it, Firefox does not. The browser usually sends the audio to
// its vendor's servers for recognition, so the spoken text leaves the device.

// The parts of the Web Speech API used here; TypeScript's DOM types do not include them.
export type SpeechRecognitionLike = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: SpeechResultEvent) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
};

export type SpeechResultEvent = {
  resultIndex: number;
  results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }>;
};

type SpeechWindow = {
  SpeechRecognition?: new () => SpeechRecognitionLike;
  webkitSpeechRecognition?: new () => SpeechRecognitionLike;
};

// Null if this browser has no speech recognition.
export function createSpeechRecognition(lang: string): SpeechRecognitionLike | null {
  const speech = window as unknown as SpeechWindow;
  const Recognition = speech.SpeechRecognition ?? speech.webkitSpeechRecognition;
  if (!Recognition) {
    return null;
  }
  const recognition = new Recognition();
  recognition.lang = lang;
  // One utterance per start: continuous mode repeats text on Android.
  recognition.continuous = false;
  recognition.interimResults = true;
  return recognition;
}

// Splits what the recogniser has so far into settled text and text it may still revise.
export function readSpeechResult(event: SpeechResultEvent): { final: string; interim: string } {
  let final = "";
  let interim = "";
  for (let index = event.resultIndex; index < event.results.length; index++) {
    const result = event.results[index];
    if (result.isFinal) {
      final += result[0].transcript;
    } else {
      interim += result[0].transcript;
    }
  }
  return { final: final.trim(), interim: interim.trim() };
}

// Adds dictated words to what is already in the field, within the length limit.
export function appendDictation(current: string, spoken: string, maxLength: number): string {
  const addition = spoken.trim();
  if (!addition) {
    return current;
  }
  const base = current.trimEnd();
  // Recognisers start in lower case; a new text or sentence starts with a capital.
  const startsSentence = base === "" || /[.!?]$/.test(base);
  const text = startsSentence ? addition[0].toUpperCase() + addition.slice(1) : addition;
  return (base ? `${base} ${text}` : text).slice(0, maxLength).trimEnd();
}

export function speechErrorMessage(error: string): string | null {
  switch (error) {
    // Stopped by the user or by leaving the page: not an error.
    case "aborted":
      return null;
    case "no-speech":
      return "Es wurde keine Sprache erkannt.";
    case "not-allowed":
    case "service-not-allowed":
      return "Der Zugriff auf das Mikrofon wurde nicht erlaubt.";
    case "audio-capture":
      return "Es wurde kein Mikrofon gefunden.";
    case "network":
      return "Die Spracherkennung ist nicht erreichbar. Sie braucht eine Internetverbindung.";
    default:
      return `Die Spracherkennung ist fehlgeschlagen (${error}).`;
  }
}
