/** @type {import('next').NextConfig} */

/**
 * The app moved from cscp.tuckertracker.com to cscp.clashapp.online. Anything
 * still arriving at the old address (bookmarks, installed PWAs) is sent to the
 * same path on the new one, permanently. API routes are left alone.
 */
const OLD_HOST = "cscp.tuckertracker.com";
const NEW_ORIGIN = "https://cscp.clashapp.online";

const nextConfig = {
  async redirects() {
    return [
      {
        source: "/:path((?!api/).*)",
        has: [{ type: "host", value: OLD_HOST }],
        destination: `${NEW_ORIGIN}/:path`,
        permanent: true,
      },
    ];
  },
};

module.exports = nextConfig;
