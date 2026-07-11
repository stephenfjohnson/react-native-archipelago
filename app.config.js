module.exports = ({ config }) => {
  return {
    ...config,
    ios: {
      ...config.ios,
      config: {
        googleMapsApiKey: process.env.EXPO_PUBLIC_GOOGLE_API_KEY_IOS,
      },
    },
    android: {
      ...config.android,
      config: {
        googleMaps: {
          // The Google Maps SDK crashes on Android if the manifest contains
          // no key at all, so a placeholder is used when building without one.
          // The map still works via the "Use OpenStreetMap map tiles" setting.
          apiKey:
            process.env.EXPO_PUBLIC_GOOGLE_API_KEY_ANDROID ??
            "google-maps-api-key-not-set",
        },
      },
    },
  };
};
