import { describe, expect, it } from "vitest";
import { appendDictation, readSpeechResult, speechErrorMessage } from "./dictation";

describe("appendDictation", () => {
  it("starts a new text with a capital letter", () => {
    expect(appendDictation("", " wartungsvertrag ab januar ", 200)).toBe("Wartungsvertrag ab januar");
  });

  it("continues existing text with a space and without changing the case", () => {
    expect(appendDictation("Angebot für ", "neue Fräsmaschine", 200)).toBe("Angebot für neue Fräsmaschine");
    expect(appendDictation("Angebot", "neue Fräsmaschine", 200)).toBe("Angebot neue Fräsmaschine");
  });

  it("starts a new sentence with a capital letter", () => {
    expect(appendDictation("Termin vereinbart.", "rückruf am montag", 200)).toBe(
      "Termin vereinbart. Rückruf am montag",
    );
  });

  it("never exceeds the length limit", () => {
    expect(appendDictation("12345678", "abc def", 10)).toBe("12345678 a");
    expect(appendDictation("", "x".repeat(300), 200)).toHaveLength(200);
  });

  it("ignores empty input", () => {
    expect(appendDictation("Text", "   ", 200)).toBe("Text");
  });
});

describe("readSpeechResult", () => {
  const result = (transcript: string, isFinal: boolean) => Object.assign([{ transcript }], { isFinal });

  it("separates settled text from text that may still change", () => {
    const event = { resultIndex: 0, results: [result("neue Maschine", true), result(" im Frühjahr", false)] };

    expect(readSpeechResult(event)).toEqual({ final: "neue Maschine", interim: "im Frühjahr" });
  });

  it("reads only the results that are new in this event", () => {
    const event = { resultIndex: 1, results: [result("schon übernommen", true), result("neuer Teil", true)] };

    expect(readSpeechResult(event)).toEqual({ final: "neuer Teil", interim: "" });
  });
});

describe("speechErrorMessage", () => {
  it("treats a stop by the user as no error", () => {
    expect(speechErrorMessage("aborted")).toBeNull();
  });

  it("explains a refused microphone", () => {
    expect(speechErrorMessage("not-allowed")).toContain("Mikrofon");
  });
});
