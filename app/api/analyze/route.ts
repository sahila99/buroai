import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "Missing GEMINI_API_KEY in .env.local" },
        { status: 500 }
      );
    }

    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const targetLanguage = (formData.get("targetLanguage") as string) || "English";
    const responseTone = (formData.get("responseTone") as string) || "submission";

    if (!file) {
      return NextResponse.json(
        { error: "No file or screenshot was uploaded." },
        { status: 400 }
      );
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const base64Data = buffer.toString("base64");
    const mimeType = file.type || "application/pdf";

    const SYSTEM_PROMPT = `
You are an institutional legal and administrative document intelligence engine.
Analyze the attached document (PDF or image).
All extracted summaries, action steps, legal explanations, and drafted response letters must be in: ${targetLanguage}.

Draft Response Letter Intent: "${responseTone}"
(Options: "submission" = Submitting requested proof/documents, "extension" = Requesting a deadline extension with legal justification, "appeal" = Formal legal objection / appeal / Widerspruch).

Respond ONLY with a valid JSON object matching this schema without markdown code blocks:

{
  "documentType": "string (Title of document in ${targetLanguage})",
  "category": "string (e.g., Taxation, Social Security, Municipal/Housing, Immigration, Legal/Court, Healthcare, Billing/Fine)",
  "detectedOriginalLanguage": "string",
  "urgency": "string (Low, Medium, High, or Urgent)",
  "urgencyReason": "string (Key factor driving urgency)",
  "summary": "string (Authoritative 2-3 sentence explanation of the document and obligations in ${targetLanguage})",
  "fullTranslatedDocument": "string (Complete line-by-line translation into ${targetLanguage})",
  "issuingAuthority": {
    "name": "string",
    "department": "string or null",
    "address": "string or null",
    "phone": "string or null",
    "email": "string or null",
    "website": "string or null"
  },
  "recipient": {
    "name": "string or null",
    "referenceNumber": "string or null (File/Case/Aktenzeichen/Expediente number)"
  },
  "financials": {
    "hasFinancialImpact": true,
    "amount": "string or null (e.g. € 833.00, $ 4,850.00)",
    "nature": "string or null (e.g. Approved Grant, Monthly Benefit, Tax Demand, Fine)",
    "paymentDeadline": "string or null",
    "bankDetails": {
      "iban": "string or null",
      "bic": "string or null",
      "reference": "string or null"
    }
  },
  "deadlines": [
    {
      "date": "string",
      "label": "string",
      "consequence": "string",
      "severity": "string (Normal, Critical, Final Notice)"
    }
  ],
  "requiredActions": [
    {
      "step": 1,
      "title": "string",
      "action": "string",
      "deadline": "string or null",
      "method": "string or null (e.g., Online Portal, Certified Mail, Email)"
    }
  ],
  "appealOptions": {
    "allowed": true,
    "deadline": "string or null",
    "body": "string or null",
    "instructions": "string or null"
  },
  "draftResponseLetter": "string (A formal, ready-to-sign reply letter tailored to the tone '${responseTone}', citing case numbers, recipient addresses, and dates in ${targetLanguage})"
}
`;

    const targetModel = "gemini-3.6-flash";
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${targetModel}:generateContent?key=${apiKey}`;

    const response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { text: SYSTEM_PROMPT },
              {
                inlineData: {
                  mimeType: mimeType,
                  data: base64Data,
                },
              },
            ],
          },
        ],
        generationConfig: {
          responseMimeType: "application/json",
          temperature: 0.1,
        },
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      console.error("[Gemini API Error]:", errorBody);
      throw new Error(`AI Engine Error: ${errorBody}`);
    }

    const data = await response.json();
    const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!rawText) {
      throw new Error("No response generated.");
    }

    const cleanedText = rawText
      .replace(/^```json\s*/i, "")
      .replace(/```\s*$/i, "")
      .trim();

    const parsedData = JSON.parse(cleanedText);

    return NextResponse.json({ success: true, data: parsedData });
  } catch (error: any) {
    console.error("[BuroAI Detailed Error]:", error);
    return NextResponse.json(
      { error: error.message || "Failed to process document." },
      { status: 500 }
    );
  }
}