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
    // Dynamic require of @napi-rs/canvas from pdfjs is easy to miss in NFT traces.
    outputFileTracingIncludes: {
      "/api/analyze": ["./node_modules/@napi-rs/canvas/**/*"],
      "/api/rank": ["./node_modules/@napi-rs/canvas/**/*"],
    },
  },
};

export default nextConfig;
