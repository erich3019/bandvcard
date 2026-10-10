import { useEffect, useRef, useState } from "react";
import { createSpeechRecognition, readSpeechResult, speechErrorMessage, type SpeechRecognitionLike } from "./dictation";

const UNSUPPORTED = "Dieser Browser unterstützt keine Spracheingabe. Sie funktioniert in Chrome, Edge und Safari.";

// German dictation with the browser's speech recognition, shared by everything that listens.
// start() takes what to do with each piece of settled text. With `continuous`, listening goes
// on across pauses until stop(); otherwise it ends after one utterance.
export function useDictation(onError: (message: string) => void) {
  const [listening, setListening] = useState(false);
  // What is being said right now, until the recogniser settles on it.
  const [interim, setInterim] = useState("");
  const session = useRef<{
    recognition: SpeechRecognitionLike | null;
    keepGoing: boolean;
    afterStop: (() => void) | null;
  }>({ recognition: null, keepGoing: false, afterStop: null });

  // Leaving the page ends a running dictation.
  useEffect(() => {
    const current = session.current;
    return () => {
      current.keepGoing = false;
      current.afterStop = null;
      current.recognition?.abort();
    };
  }, []);

  function listen(onText: (text: string) => void): boolean {
    const speech = createSpeechRecognition("de-DE");
    if (!speech) {
      onError(UNSUPPORTED);
      return false;
    }

    speech.onresult = (event) => {
      const spoken = readSpeechResult(event);
      if (spoken.final) {
        onText(spoken.final);
      }
      setInterim(spoken.interim);
    };
    speech.onerror = (event) => {
      // A pause while listening continuously is expected, not an error.
      if (event.error === "no-speech" && session.current.keepGoing) {
        return;
      }
      session.current.keepGoing = false;
      const message = speechErrorMessage(event.error);
      if (message) {
        onError(message);
      }
    };
    speech.onend = () => {
      setInterim("");
      // The recogniser stops after each utterance; start a new one instead of using its
      // continuous mode, which repeats text on Android.
      if (session.current.keepGoing && listen(onText)) {
        return;
      }
      session.current.recognition = null;
      setListening(false);
      const afterStop = session.current.afterStop;
      session.current.afterStop = null;
      afterStop?.();
    };
    session.current.recognition = speech;
    speech.start();
    return true;
  }

  function start(onText: (text: string) => void, options: { continuous?: boolean } = {}) {
    if (session.current.recognition) {
      return;
    }
    session.current.keepGoing = options.continuous ?? false;
    if (listen(onText)) {
      setListening(true);
    }
  }

  // The recogniser may still deliver the last words after stop(); `after` runs once it has
  // really ended (immediately if nothing is running).
  function stop(after?: () => void) {
    session.current.keepGoing = false;
    if (!session.current.recognition) {
      after?.();
      return;
    }
    session.current.afterStop = after ?? null;
    session.current.recognition.stop();
  }

  return { listening, interim, start, stop };
}
