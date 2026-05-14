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

// Mock Supabase
jest.mock('./src/lib/supabase', () => ({
  supabase: {
    from: jest.fn(() => ({
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          single: jest.fn(() => Promise.resolve({ data: null, error: null })),
          order: jest.fn(() => ({
            then: jest.fn((cb) => cb({ data: [], error: null })),
          })),
        })),
        order: jest.fn(() => ({
          then: jest.fn((cb) => cb({ data: [], error: null })),
        })),
        match: jest.fn(() => ({
          order: jest.fn(() => Promise.resolve({ data: [], error: null })),
        })),
      })),
    })),
    auth: {
      getUser: jest.fn(() => Promise.resolve({ data: { user: null }, error: null })),
      onAuthStateChange: jest.fn(() => ({ data: { subscription: { unsubscribe: jest.fn() } } })),
    }
  }
}));
