import { createCanvas, loadImage } from "@napi-rs/canvas";
import OpenAI from "openai";
import { renderPageAsImage } from "unpdf";

const VISION_NAME_MODEL = "gpt-4o";

/**
 * Rasterizes page 1 of a PDF and asks a vision model for the heading name.
 * On any failure returns "" so callers can fall back to text-based extraction.
 */
export async function extractNameFromPdfVision(
  pdfBuffer: Buffer,
): Promise<string> {
  try {
    const pngBytes = await renderPageAsImage(new Uint8Array(pdfBuffer), 1, {
      canvasImport: () => import("@napi-rs/canvas"),
      scale: 1.25,
    });
    const img = await loadImage(new Uint8Array(pngBytes));
    const canvas = createCanvas(img.width, img.height);
    const ctx = canvas.getContext("2d");
    ctx.drawImage(img, 0, 0);
    const jpegBytes = canvas.toBuffer("image/jpeg", 85);
    const base64 = jpegBytes.toString("base64");

    const key = process.env.OPENAI_API_KEY;
    if (!key?.trim()) {
      return "";
    }

    const openai = new OpenAI({ apiKey: key });

    // Vision name extraction: ~85 tokens at detail:low (~$0.000085/call)
    // Runs once per upload. Falls back to text extraction on failure.
    const completion = await openai.chat.completions.create({
      model: VISION_NAME_MODEL,
      max_tokens: 128,
      messages: [
        {
          role: "system",
          content: "You extract candidate names from resume images.",
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "What is the candidate's full name exactly as printed in the largest heading on this page? Return only the full name, nothing else. Include all name parts — given name, middle name, and surname.",
            },
            {
              type: "image_url",
              image_url: {
                url: `data:image/jpeg;base64,${base64}`,
                detail: "low",
              },
            },
          ],
        },
      ],
    });

    return completion.choices[0]?.message?.content?.trim() ?? "";
  } catch (err) {
    console.error("[extractNameFromPdfVision]", err);
    return "";
  }
}
