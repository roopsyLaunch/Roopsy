const fs = require('fs');
const path = require('path');

// 1. Patch warnOfExpoGoPushUsage.js to prevent throw in Expo Go
const warnPath = path.join(__dirname, '..', 'node_modules', 'expo-notifications', 'build', 'warnOfExpoGoPushUsage.js');
if (fs.existsSync(warnPath)) {
  let content = fs.readFileSync(warnPath, 'utf8');
  if (content.includes("throw new Error(message);")) {
    content = content.replace("throw new Error(message);", "didWarn = true;\n        console.warn(message);");
    fs.writeFileSync(warnPath, content, 'utf8');
    console.log('[patch] Patched expo-notifications warnOfExpoGoPushUsage.js successfully.');
  }
}

// 2. Patch TopicSubscriptionModule.android.js so Expo Go does not crash when ExpoTopicSubscriptionModule native module is missing
const topicPath = path.join(__dirname, '..', 'node_modules', 'expo-notifications', 'build', 'TopicSubscriptionModule.android.js');
if (fs.existsSync(topicPath)) {
  const safeContent = `import { requireOptionalNativeModule } from 'expo-modules-core';

const fallbackModule = {
  addListener: () => {},
  removeListeners: () => {},
  subscribeToTopicAsync: () => Promise.resolve(null),
  unsubscribeFromTopicAsync: () => Promise.resolve(null),
};

let nativeModule = null;
try {
  nativeModule = requireOptionalNativeModule('ExpoTopicSubscriptionModule');
} catch (e) {
  nativeModule = null;
}

export default nativeModule || fallbackModule;
`;
  fs.writeFileSync(topicPath, safeContent, 'utf8');
  console.log('[patch] Patched expo-notifications TopicSubscriptionModule.android.js successfully.');
}
