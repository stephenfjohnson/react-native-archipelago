import { Platform } from "react-native";
import BackgroundService from "react-native-background-actions";

// Keeps a foreground service alive for the duration of a connected session so
// that Android does not revoke the app's network access while backgrounded
// (which otherwise closes the Archipelago socket the moment the app loses
// focus). The socket itself lives in the shared archipelago.js Client — this
// service's only job is to keep the process network-eligible in the background.
//
// No-op on iOS, where this mechanism does not exist.

const options = {
  taskName: "ArchipelagoConnection",
  taskTitle: "Connected to Archipelago",
  taskDesc: "Keeping your connection alive.",
  taskIcon: {
    name: "ic_launcher",
    type: "mipmap",
  },
  // Android 14+ requires a typed foreground service; "dataSync" matches a
  // long-lived network connection. This is passed to startForeground() at
  // runtime and must match the android:foregroundServiceType merged onto the
  // service in AndroidManifest.xml, alongside the FOREGROUND_SERVICE_DATA_SYNC
  // permission.
  foregroundServiceType: ["dataSync" as const],
};

// The task body simply parks until the service is stopped. react-native-
// background-actions resolves the promise's veto when BackgroundService.stop()
// is called, so we await forever and let stop() tear it down.
const keepAlive = async () => {
  await new Promise<void>(() => {
    /* never resolves; the service is torn down by stopConnectionService() */
  });
};

export async function startConnectionService(): Promise<void> {
  if (Platform.OS !== "android") return;
  if (BackgroundService.isRunning()) return;
  try {
    await BackgroundService.start(keepAlive, options);
  } catch (e) {
    console.log("Failed to start background connection service", e);
  }
}

export async function stopConnectionService(): Promise<void> {
  if (Platform.OS !== "android") return;
  if (!BackgroundService.isRunning()) return;
  try {
    await BackgroundService.stop();
  } catch (e) {
    console.log("Failed to stop background connection service", e);
  }
}
