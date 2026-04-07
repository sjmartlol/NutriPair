const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

/** Read key from `.env` when Expo/dotenv did not set it (empty env vars in shell block merges). */
function geminiKeyFromDotEnvFile() {
  try {
    const parsed = dotenv.parse(fs.readFileSync(path.join(__dirname, '.env'), 'utf8'));
    return parsed.EXPO_PUBLIC_GEMINI_API_KEY ?? '';
  } catch {
    return '';
  }
}

/** @param {{ config: import('expo/config').ExpoConfig }} ctx */
module.exports = ({ config }) => {
  const fromEnv = (process.env.EXPO_PUBLIC_GEMINI_API_KEY ?? '').trim();
  const fromFile = geminiKeyFromDotEnvFile().trim();
  return {
    ...config,
    extra: {
      ...config.extra,
      geminiApiKey: fromEnv || fromFile,
    },
  };
};
