/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config, { isServer }) => {
    if (isServer) {
      // @napi-rs/canvas ships a .node binary; webpack must not parse it as JS.
      config.externals.push("@napi-rs/canvas");
    }
    return config;
  },
};

export default nextConfig;
