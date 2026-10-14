const { withAndroidManifest } = require("@expo/config-plugins");

/** @param {{ config: Record<string, unknown> }} ctx */
module.exports = ({ config }) => {
  let modifiedConfig = {
    ...config,
    name: "ROOPSY",
    slug: "roopsy",
    extra: {
      ...(typeof config.extra === "object" && config.extra !== null ? config.extra : {}),
      apiUrl: process.env.EXPO_PUBLIC_API_URL || "http://76.13.246.224:4000",
    },
  };

  return withAndroidManifest(modifiedConfig, (modConfig) => {
    const app = modConfig.modResults?.manifest?.application?.[0];
    if (app && app.$) {
      app.$["android:usesCleartextTraffic"] = "true";
    }
    return modConfig;
  });
};
