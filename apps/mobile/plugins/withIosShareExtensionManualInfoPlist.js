/**
 * Xcode's GENERATE_INFOPLIST_FILE merges a synthesized plist with the
 * ShareExtension-Info.plist from expo-share-intent. That merge can duplicate or
 * corrupt NSExtensionActivationRule and fail App Store validation.
 *
 * Use only our committed ShareExtension-Info.plist for the extension target.
 *
 * See: invalid NSExtensionActivationRule / duplicate rules (Apple validation).
 */

const { withXcodeProject } = require("@expo/config-plugins");

function withIosShareExtensionManualInfoPlist(config) {
  return withXcodeProject(config, (cfg) => {
    const configurations = cfg.modResults.pbxXCBuildConfigurationSection();
    for (const entry of Object.values(configurations)) {
      if (
        !entry ||
        typeof entry !== "object" ||
        !entry.buildSettings ||
        typeof entry.buildSettings.INFOPLIST_FILE !== "string"
      ) {
        continue;
      }
      const plistPath = entry.buildSettings.INFOPLIST_FILE.replace(/"/g, "");
      if (plistPath.includes("ShareExtension-Info.plist")) {
        entry.buildSettings.GENERATE_INFOPLIST_FILE = "NO";
      }
    }
    return cfg;
  });
}

module.exports = withIosShareExtensionManualInfoPlist;
