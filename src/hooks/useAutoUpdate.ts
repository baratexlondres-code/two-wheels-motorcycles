import { useEffect, useState } from "react";
import { isCapacitor } from "@/App";

const GITHUB_RELEASES_URL =
  "https://api.github.com/repos/baratexlondres-code/two-wheels-motorcycles/releases/latest";

const CURRENT_VERSION = "1.0.7"; // updated each build

interface UpdateInfo {
  version: string;
  downloadUrl: string;
  releaseNotes: string;
}

export function useAutoUpdate() {
  const [updateAvailable, setUpdateAvailable] = useState<UpdateInfo | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (!isCapacitor) return; // Only run on Android/iOS

    const checkForUpdate = async () => {
      try {
        const res = await fetch(GITHUB_RELEASES_URL, {
          headers: { Accept: "application/vnd.github.v3+json" },
        });
        if (!res.ok) return;
        const data = await res.json();
        const latestVersion: string = data.tag_name?.replace(/^v/, "") ?? "";

        if (!latestVersion) return;

        // Compare versions: if latest > current, show update dialog
        if (isNewerVersion(latestVersion, CURRENT_VERSION)) {
          // Find the APK asset
          const apkAsset = data.assets?.find(
            (a: any) =>
              a.name.endsWith(".apk") && a.browser_download_url
          );
          setUpdateAvailable({
            version: latestVersion,
            downloadUrl: apkAsset?.browser_download_url ?? data.html_url,
            releaseNotes: data.body ?? "",
          });
        }
      } catch (e) {
        // Silently fail — no internet or API error
        console.log("Update check failed:", e);
      }
    };

    // Check after 2 seconds so the app is fully loaded
    const timer = setTimeout(checkForUpdate, 2000);
    return () => clearTimeout(timer);
  }, []);

  const dismiss = () => setDismissed(true);

  return { updateAvailable: dismissed ? null : updateAvailable, dismiss };
}

function isNewerVersion(latest: string, current: string): boolean {
  const parse = (v: string) => v.split(".").map((n) => parseInt(n, 10) || 0);
  const [lMaj, lMin, lPatch] = parse(latest);
  const [cMaj, cMin, cPatch] = parse(current);
  if (lMaj !== cMaj) return lMaj > cMaj;
  if (lMin !== cMin) return lMin > cMin;
  return lPatch > cPatch;
}
