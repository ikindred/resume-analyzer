/**
 * pdf.js in Node uses a "fake worker" that dynamic-imports `pdf.worker.mjs`. Next/Vercel
 * file tracing often omits that file; we set an absolute file:// URL and list the folder
 * in `next.config.mjs` `outputFileTracingIncludes`.
 *
 * Import this module before any `pdf-parse` import. DOM shims live in `pdfDomPolyfills.ts`
 * so they run before this file loads `pdfjs-dist`.
 */
import path from "node:path";
import { pathToFileURL } from "node:url";
import "./pdfDomPolyfills";
import * as pdfjs from "pdfjs-dist/legacy/build/pdf.mjs";

const workerFile = path.join(
  process.cwd(),
  "node_modules",
  "pdfjs-dist",
  "legacy",
  "build",
  "pdf.worker.mjs",
);
pdfjs.GlobalWorkerOptions.workerSrc = pathToFileURL(workerFile).href;
