/** @param {{ config: Record<string, unknown> }} ctx */
module.exports = ({ config }) => ({
  ...config,
  name: "ROOPSY",
  slug: "roopsy",
  extra: {
    ...(typeof config.extra === "object" && config.extra !== null ? config.extra : {}),
    apiUrl: process.env.EXPO_PUBLIC_API_URL || "",
  },
});
