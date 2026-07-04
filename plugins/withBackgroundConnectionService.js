const { withAndroidManifest } = require("@expo/config-plugins");

// react-native-background-actions declares its foreground service without a
// foregroundServiceType. Android 14+ (API 34) requires every foreground service
// to declare a type, or startForeground() crashes with
// MissingForegroundServiceTypeException. This plugin bakes the "dataSync" type
// (a long-lived network connection) and the matching permission into the
// generated AndroidManifest so it survives `expo prebuild` — a raw manifest
// edit would be wiped, since android/ is gitignored and regenerated from config.

const SERVICE_NAME = "com.asterinet.react.bgactions.RNBackgroundActionsTask";
const PERMISSIONS = [
  "android.permission.FOREGROUND_SERVICE",
  "android.permission.FOREGROUND_SERVICE_DATA_SYNC",
];

function ensurePermissions(manifest) {
  if (!Array.isArray(manifest["uses-permission"])) {
    manifest["uses-permission"] = [];
  }
  const existing = new Set(
    manifest["uses-permission"].map((p) => p.$?.["android:name"]),
  );
  for (const name of PERMISSIONS) {
    if (!existing.has(name)) {
      manifest["uses-permission"].push({ $: { "android:name": name } });
    }
  }
}

function ensureServiceType(application) {
  if (!Array.isArray(application.service)) {
    application.service = [];
  }
  let service = application.service.find(
    (s) => s.$?.["android:name"] === SERVICE_NAME,
  );
  if (!service) {
    service = { $: { "android:name": SERVICE_NAME } };
    application.service.push(service);
  }
  service.$["android:foregroundServiceType"] = "dataSync";
}

module.exports = function withBackgroundConnectionService(config) {
  return withAndroidManifest(config, (cfg) => {
    const manifest = cfg.modResults.manifest;
    ensurePermissions(manifest);
    ensureServiceType(manifest.application[0]);
    return cfg;
  });
};
