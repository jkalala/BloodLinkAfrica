import { logger, LogLevel, LogEntry } from '../../lib/logging-service';

describe('LoggingService', () => {
  let consoleSpy: jest.SpyInstance;

  beforeEach(() => {
    // Spy on console methods to capture logs
    consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'info').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.spyOn(console, 'debug').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleSpy.mockRestore();
  });

  it('should log debug messages when level is DEBUG', () => {
    logger.setMinLogLevel(LogLevel.DEBUG);
    logger.debug('Test debug message', { key: 'value' });
    expect(console.debug).toHaveBeenCalled();
  });

  it('should not log debug messages when level is INFO', () => {
    logger.setMinLogLevel(LogLevel.INFO);
    logger.debug('Test debug message');
    expect(console.debug).not.toHaveBeenCalled();
  });

  it('should log info messages when level is INFO', () => {
    logger.setMinLogLevel(LogLevel.INFO);
    logger.info('Test info message');
    expect(console.info).toHaveBeenCalled();
  });

  it('should log warn messages when level is WARN', () => {
    logger.setMinLogLevel(LogLevel.WARN);
    logger.warn('Test warn message');
    expect(console.warn).toHaveBeenCalled();
  });

  it('should log error messages when level is ERROR', () => {
    logger.setMinLogLevel(LogLevel.ERROR);
    logger.error('Test error message', new Error('Something went wrong'));
    expect(console.error).toHaveBeenCalled();
  });

  it('should log critical messages when level is CRITICAL', () => {
    logger.setMinLogLevel(LogLevel.CRITICAL);
    logger.critical('Test critical message', new Error('Critical failure'));
    expect(console.error).toHaveBeenCalled();
  });

  it('should include context in log entry', () => {
    logger.setMinLogLevel(LogLevel.DEBUG);
    const context = { transactionId: '123', userId: 'abc' };
    logger.debug('Message with context', context);
    const loggedArgs = (console.debug as jest.Mock).mock.calls[0];
    expect(loggedArgs[1]).toEqual(context);
  });

  it('should include error details in log entry', () => {
    logger.setMinLogLevel(LogLevel.ERROR);
    const error = new Error('Test Error');
    error.stack = 'Error stack trace';
    logger.error('Error message', error);
    const loggedArgs = (console.error as jest.Mock).mock.calls[0];
    expect(loggedArgs[2]).toEqual(expect.objectContaining({
      name: 'Error',
      message: 'Test Error',
      stack: 'Error stack trace',
    }));
  });

  it('should correctly set minimum log level', () => {
    logger.setMinLogLevel(LogLevel.WARN);
    logger.info('Info message');
    expect(console.info).not.toHaveBeenCalled();
    logger.warn('Warn message');
    expect(console.warn).toHaveBeenCalled();
  });

  it('should not send to external services in development', () => {
    const originalNodeEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';
    const fetchSpy = jest.spyOn(global, 'fetch');

    logger.info('Test message for external service');
    expect(fetchSpy).not.toHaveBeenCalled();

    process.env.NODE_ENV = originalNodeEnv;
    fetchSpy.mockRestore();
  });

  // Add more tests for specific scenarios, e.g., production environment, custom log levels
});
