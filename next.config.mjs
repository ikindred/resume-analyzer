/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // pdfjs-dist (pulled in by pdf-parse) is not compatible with webpack RSC bundling
    serverComponentsExternalPackages: [
      "pdf-parse",
      "pdfjs-dist",
      "@napi-rs/canvas",
      "dommatrix",
    ],
    // pdf.js fake worker dynamic-imports pdf.worker.mjs (sibling of pdf.mjs); NFT often skips it.
    // Include legacy build assets; optional wasm/cmaps help some PDFs.
    outputFileTracingIncludes: {
      "/api/analyze": [
        "./node_modules/pdfjs-dist/legacy/build/**/*",
        "./node_modules/pdfjs-dist/legacy/image_decoders/**/*",
        "./node_modules/@napi-rs/canvas/**/*",
      ],
      "/api/rank": [
        "./node_modules/pdfjs-dist/legacy/build/**/*",
        "./node_modules/pdfjs-dist/legacy/image_decoders/**/*",
        "./node_modules/@napi-rs/canvas/**/*",
      ],
    },
  },
};

export default nextConfig;
