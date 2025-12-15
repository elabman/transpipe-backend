// Test setup file
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test_jwt_secret_key';
process.env.DB_NAME = 'transpipe_test_db';
process.env.LOG_LEVEL = 'error';
process.env.PORT = '0'; // Use random port for tests

// Suppress console logs during tests
if (process.env.NODE_ENV === 'test') {
  console.log = jest.fn();
  console.info = jest.fn();
  console.warn = jest.fn();
}