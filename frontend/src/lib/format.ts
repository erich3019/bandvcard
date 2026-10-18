// Dates and numbers in the de-CH locale, as the design guide asks. The time zone is fixed,
// so server and browser render the same text.
const timeZone = "Europe/Zurich";

export const formatDate = new Intl.DateTimeFormat("de-CH", { dateStyle: "medium", timeZone }).format;

export const formatDateTime = new Intl.DateTimeFormat("de-CH", { dateStyle: "medium", timeStyle: "short", timeZone })
  .format;

// "Sonntag, 18. Oktober 2026"
export const formatLongDate = new Intl.DateTimeFormat("de-CH", { dateStyle: "full", timeZone }).format;

export const formatNumber = new Intl.NumberFormat("de-CH").format;
