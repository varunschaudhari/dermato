const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');

/**
 * Metro configuration
 * https://reactnative.dev/docs/metro
 *
 * @type {import('@react-native/metro-config').MetroConfig}
 */
// lucide-react-native ships ESM (.mjs) icon files reachable via its
// package.json "exports" map; Metro's default sourceExts doesn't include
// "mjs", so without this it fails to resolve every icon import.
const config = {
  resolver: {
    sourceExts: ['mjs', 'js', 'jsx', 'ts', 'tsx', 'json'],
  },
};

module.exports = mergeConfig(getDefaultConfig(__dirname), config);
