const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// expo-media-library's package.json "exports" field points its default
// condition at raw TypeScript source (src/index.ts) instead of the compiled
// build/index.js. Metro's package-exports resolution hits a bug resolving
// that source file's internal relative imports on Windows ("None of these
// files exist: ...ExpoMediaLibraryNext(.ts|...)" even though the file exists).
// Disabling package-exports resolution makes Metro fall back to the "main"
// field (build/index.js) like every other dependency already does.
config.resolver.unstable_enablePackageExports = false;

module.exports = config;
