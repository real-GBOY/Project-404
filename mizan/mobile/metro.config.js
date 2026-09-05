// Learn more: https://docs.expo.dev/guides/monorepos/
const path = require("path");
const { getDefaultConfig } = require("expo/metro-config");

const projectRoot = __dirname;
const config = getDefaultConfig(projectRoot);

// `mizan/mobile` sits inside the AURIC repo, whose root `node_modules` carries
// its own (different) copy of `react` for web tooling. Pin the singletons that
// must not be duplicated in the native bundle to this app's own copies, while
// leaving normal hierarchical resolution intact for everything else.
const pinned = ["react", "react-native", "react-dom"];
config.resolver.extraNodeModules = pinned.reduce((acc, name) => {
  acc[name] = path.resolve(projectRoot, "node_modules", name);
  return acc;
}, {});

module.exports = config;
