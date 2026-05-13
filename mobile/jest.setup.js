jest.mock('react-native-worklets', () => ({
  Worklets: {
    createRunOnJS: (fn) => fn,
    createRunOnContext: (fn) => fn,
  },
  createSerializable: (val) => val,
  isWorklet: () => false,
  isWorkletFunction: () => false,
  RuntimeKind: {
    JS: 0,
    ReactNative: 1,
    Background: 2,
    UI: 3,
  },
  serializableMappingCache: new Map(),
  scheduleOnUI: (fn) => fn,
}));

jest.mock('react-native-reanimated', () => {
  const Reanimated = require('react-native-reanimated/mock');
  Reanimated.default.call = () => {};
  return Reanimated;
});

// Mock react-native-reanimated/plugin as well just in case
jest.mock('react-native-reanimated/plugin', () => ({}));

// Silence the warning: Animated: `useNativeDriver` is not supported because the native animated module is missing
try {
  jest.mock('react-native/Libraries/Animated/NativeAnimatedHelper');
} catch (e) {}
