// AsyncStorage has no implementation in the test environment — use the official
// in-memory jest mock so repository/store code runs without a native module.
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
