/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // pdfjs-dist (pulled in by pdf-parse) is not compatible with webpack RSC bundling
    serverComponentsExternalPackages: ["pdf-parse", "pdfjs-dist"],
  },
};

export default nextConfig;
