import { NextRequest, NextResponse } from "next/server";

// Google Sheets API route
// Usage: POST /api/sheets { sheetId: "...", range: "Sheet1!A1:D50" }
// Returns: { data: [[roll, theory, mcq, practical], ...] }
//
// Requires a Google API Key in .env.local:
//   GOOGLE_SHEETS_API_KEY=your_api_key_here
//
// To get an API key:
// 1. Go to https://console.cloud.google.com
// 2. Create a project (or select existing)
// 3. Enable "Google Sheets API"
// 4. Go to Credentials → Create Credentials → API Key
// 5. Add it to .env.local as GOOGLE_SHEETS_API_KEY
// 6. Make the Google Sheet publicly readable (Share → Anyone with link → Viewer)

export async function POST(req: NextRequest) {
    try {
        const { sheetId, range } = await req.json();

        if (!sheetId || !range) {
            return NextResponse.json({ error: "sheetId and range are required" }, { status: 400 });
        }

        const apiKey = process.env.GOOGLE_SHEETS_API_KEY;
        if (!apiKey) {
            return NextResponse.json(
                { error: "GOOGLE_SHEETS_API_KEY not configured in .env.local" },
                { status: 500 }
            );
        }

        const url = `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(sheetId)}/values/${encodeURIComponent(range)}?key=${apiKey}`;
        const res = await fetch(url);

        if (!res.ok) {
            const errText = await res.text();
            return NextResponse.json(
                { error: `Google API error: ${res.status} — ${errText}` },
                { status: res.status }
            );
        }

        const json = await res.json();
        // json.values is a 2D array: [[header1, header2, ...], [val1, val2, ...], ...]
        return NextResponse.json({ data: json.values || [] });
    } catch (err: unknown) {
        return NextResponse.json({ error: err instanceof Error ? err.message : "Internal error" }, { status: 500 });
    }
}
