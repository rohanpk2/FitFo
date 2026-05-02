/**
 * Xcode's GENERATE_INFOPLIST_FILE merges a synthesized plist with the extension
 * plist. That merge can duplicate or corrupt NSExtensionActivationRule and
 * fail App Store / TestFlight validation.
 *
 * Forces GENERATE_INFOPLIST_FILE = NO for the share extension target and aligns
 * PRODUCT_BUNDLE_IDENTIFIER with expo-share-intent's iosShareExtensionBundleIdentifier when set.
 */

const { withXcodeProject } = require("@expo/config-plugins");

function getShareIntentOptions(config) {
  const plugins = config.plugins ?? [];
  for (const entry of plugins) {
    if (Array.isArray(entry) && entry[0] === "expo-share-intent" && entry[1]) {
      return entry[1];
    }
  }
  return {};
}

/** Paths from expo-share-intent (`ShareExtension-Info.plist`) or manual `fitfoShare/Info.plist`. */
function isShareExtensionPlist(plistPath) {
  const p = String(plistPath || "").replace(/"/g, "");
  return (
    p.includes("ShareExtension-Info.plist") || p.includes("fitfoShare/Info.plist")
  );
}

function withIosShareExtensionManualInfoPlist(config) {
  return withXcodeProject(config, (cfg) => {
    const opts = getShareIntentOptions(cfg);
    const parentBundleId =
      (cfg.ios?.bundleIdentifier && String(cfg.ios.bundleIdentifier).trim()) ||
      "com.fitfo.mobile";

    let shareBundleId =
      opts.iosShareExtensionBundleIdentifier &&
      String(opts.iosShareExtensionBundleIdentifier).trim();
    if (!shareBundleId) {
      shareBundleId = `${parentBundleId}.fitfoShare`;
    }

    const configurations = cfg.modResults.pbxXCBuildConfigurationSection();
    for (const entry of Object.values(configurations)) {
      if (!entry || typeof entry !== "object" || !entry.buildSettings) {
        continue;
      }
      const bs = entry.buildSettings;
      const plistFile =
        typeof bs.INFOPLIST_FILE === "string"
          ? bs.INFOPLIST_FILE.replace(/"/g, "")
          : "";
      const productName =
        typeof bs.PRODUCT_NAME === "string"
          ? bs.PRODUCT_NAME.replace(/"/g, "")
          : "";

      const isShareExtension =
        isShareExtensionPlist(plistFile) ||
        productName === "fitfoShare" ||
        productName === "FitFoMobileShare";

      if (!isShareExtension) {
        continue;
      }

      bs.GENERATE_INFOPLIST_FILE = "NO";
      bs.PRODUCT_BUNDLE_IDENTIFIER = shareBundleId;
    }
    return cfg;
  });
}

module.exports = withIosShareExtensionManualInfoPlist;
