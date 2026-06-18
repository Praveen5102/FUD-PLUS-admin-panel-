const INDIAN_CALENDAR_ID = "en.indian#holiday@group.v.calendar.google.com";

export interface FetchedHoliday {
  title: string;
  holiday_date: string;
  description: string;
}

export async function fetchGoogleHolidaysForYear(year: number): Promise<FetchedHoliday[]> {
  const apiKey = import.meta.env.VITE_GOOGLE_CALENDAR_API_KEY as string;
  if (!apiKey) throw new Error("Google Calendar API key is not configured.");

  const timeMin = encodeURIComponent(`${year}-01-01T00:00:00Z`);
  const timeMax = encodeURIComponent(`${year}-12-31T23:59:59Z`);
  const url = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(INDIAN_CALENDAR_ID)}/events?timeMin=${timeMin}&timeMax=${timeMax}&singleEvents=true&orderBy=startTime&key=${apiKey}`;

  const res = await fetch(url);
  if (!res.ok) throw new Error(`Google Calendar API responded with ${res.status}`);
  const data = await res.json();
  if (!data.items?.length) return [];

  return data.items.map((event: any) => ({
    title: event.summary ?? "Holiday",
    holiday_date: (event.start?.date ?? event.start?.dateTime ?? "").split("T")[0],
    description: event.description ?? "",
  }));
}
