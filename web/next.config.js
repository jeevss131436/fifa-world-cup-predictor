/** @type {import('next').NextConfig} */

// The FastAPI sub-server. Override with PY_API_URL in production if it runs
// somewhere other than localhost:8000.
const PY_API_URL = process.env.PY_API_URL || "http://127.0.0.1:8000";

const nextConfig = {
  async rewrites() {
    return [
      {
        // Any frontend fetch to /api/py/<path> is transparently proxied to the
        // FastAPI server, so the browser only ever talks to the Next.js origin.
        //   fetch("/api/py/predict")  ->  POST http://127.0.0.1:8000/predict
        source: "/api/py/:path*",
        destination: `${PY_API_URL}/:path*`,
      },
    ];
  },
};

module.exports = nextConfig;
