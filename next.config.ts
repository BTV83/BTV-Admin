import type { NextConfig } from "next";

const isProd = process.env.NODE_ENV === "production";

const nextConfig: NextConfig = {
  // The panel serves no optimised images, and turning this off removes the
  // next/image + sharp (libvips) attack surface entirely. Remote media from
  // Supabase Storage and Mux is displayed with plain <img>.
  images: { unoptimized: true },

  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "no-referrer" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          // Production only. Sent over plain http://localhost it pins the whole
          // localhost origin to HTTPS in the browser — for every port, breaking
          // this and any other local project until the pin is cleared by hand.
          ...(isProd
            ? [
                {
                  key: "Strict-Transport-Security",
                  value: "max-age=63072000; includeSubDomains; preload",
                },
              ]
            : []),
          // Keep the panel out of search engines even if it is ever reachable.
          { key: "X-Robots-Tag", value: "noindex, nofollow" },
        ],
      },
    ];
  },
};

export default nextConfig;
