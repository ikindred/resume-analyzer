import { createCanvas, loadImage } from "@napi-rs/canvas";
import OpenAI from "openai";
import { getDocumentProxy, renderPageAsImage } from "unpdf";

const OCR_MODEL = "gpt-4o";
/** Avoid oversized payloads / runaway cost on very long PDFs. */
const MAX_PAGES = 25;

/**
 * Renders every page to JPEG and asks one vision call to transcribe the resume.
 * Returns null on failure (caller shows 400).
 */
export async function transcribeScannedPdfVision(
  pdfBuffer: Buffer,
): Promise<string | null> {
  try {
    const key = process.env.OPENAI_API_KEY?.trim();
    if (!key) {
      return null;
    }

    const pdf = await getDocumentProxy(new Uint8Array(pdfBuffer));
    const numPages = Math.min(pdf.numPages, MAX_PAGES);

    const imageParts: OpenAI.Chat.ChatCompletionContentPart[] = [];
    for (let page = 1; page <= numPages; page++) {
      const pngBytes = await renderPageAsImage(new Uint8Array(pdfBuffer), page, {
        canvasImport: () => import("@napi-rs/canvas"),
        scale: 1.5,
      });
      const img = await loadImage(new Uint8Array(pngBytes));
      const canvas = createCanvas(img.width, img.height);
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0);
      const jpegBytes = canvas.toBuffer("image/jpeg", 85);
      const base64 = jpegBytes.toString("base64");
      imageParts.push({
        type: "image_url",
        image_url: {
          url: `data:image/jpeg;base64,${base64}`,
          detail: "high",
        },
      });
    }

    const openai = new OpenAI({ apiKey: key });

    // Full OCR fallback: ~1020 tokens/page at detail:high (~$0.001/page)
    // Only runs when pdf-parse returns < 100 chars (image-only PDF)
    const completion = await openai.chat.completions.create({
      model: OCR_MODEL,
      max_tokens: 16000,
      messages: [
        {
          role: "system",
          content:
            "You are a resume transcriber. Extract all text content from this resume image exactly as written. Preserve section headings, bullet points, and structure.",
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `These ${numPages} image(s) are resume pages in order (page 1 first). Transcribe all visible text.`,
            },
            ...imageParts,
          ],
        },
      ],
    });

    const out = completion.choices[0]?.message?.content?.trim();
    return out?.length ? out : null;
  } catch (err) {
    console.error("[transcribeScannedPdfVision]", err);
    return null;
  }
}
