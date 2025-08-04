/**
 * Centralized Logging Service
 * Provides structured logging capabilities with different severity levels.
 * Can be extended to integrate with external logging platforms (e.g., Sentry, Datadog, ELK Stack).
 */

export enum LogLevel {
  DEBUG = 'DEBUG',
  INFO = 'INFO',
  WARN = 'WARN',
  ERROR = 'ERROR',
  CRITICAL = 'CRITICAL',
}

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  context?: Record<string, unknown>;
  error?: { 
    name: string;
    message: string;
    stack?: string;
    details?: unknown;
  };
  userId?: string;
  requestId?: string;
  correlationId?: string;
}

class LoggingService {
  private minLogLevel: LogLevel = LogLevel.INFO;

  constructor(minLevel: LogLevel = LogLevel.INFO) {
    this.minLogLevel = minLevel;
    this.initialize();
  }

  private initialize(): void {
    console.log(`📊 Logging service initialized. Minimum log level: ${this.minLogLevel}`);
    // Here, you would typically set up connections to external logging services
    // e.g., Sentry.init(), Winston transports, etc.
  }

  public setMinLogLevel(level: LogLevel): void {
    this.minLogLevel = level;
    console.log(`📊 Minimum log level set to: ${this.minLogLevel}`);
  }

  public debug(message: string, context?: Record<string, unknown>): void {
    this.log(LogLevel.DEBUG, message, context);
  }

  public info(message: string, context?: Record<string, unknown>): void {
    this.log(LogLevel.INFO, message, context);
  }

  public warn(message: string, context?: Record<string, unknown>): void {
    this.log(LogLevel.WARN, message, context);
  }

  public error(message: string, error?: Error, context?: Record<string, unknown>): void {
    this.log(LogLevel.ERROR, message, context, error);
  }

  public critical(message: string, error?: Error, context?: Record<string, unknown>): void {
    this.log(LogLevel.CRITICAL, message, context, error);
  }

  private log(level: LogLevel, message: string, context?: Record<string, unknown>, error?: Error): void {
    if (this.shouldLog(level)) {
      const logEntry: LogEntry = {
        timestamp: new Date().toISOString(),
        level,
        message,
        context,
      };

      if (error) {
        logEntry.error = {
          name: error.name,
          message: error.message,
          stack: error.stack,
          details: (error as any).details, // Assuming AppError might have a details property
        };
      }

      // Add common context from environment or global state if available
      // logEntry.userId = getUserIdFromContext();
      // logEntry.requestId = getRequestIdFromContext();
      // logEntry.correlationId = getCorrelationIdFromContext();

      this.outputLog(logEntry);
      this.sendToExternalServices(logEntry);
    }
  }

  private shouldLog(level: LogLevel): boolean {
    const levels = [LogLevel.DEBUG, LogLevel.INFO, LogLevel.WARN, LogLevel.ERROR, LogLevel.CRITICAL];
    return levels.indexOf(level) >= levels.indexOf(this.minLogLevel);
  }

  private outputLog(logEntry: LogEntry): void {
    const { timestamp, level, message, context, error } = logEntry;
    const logMessage = `[${timestamp}] [${level}] ${message}`;

    switch (level) {
      case LogLevel.DEBUG:
        console.debug(logMessage, context || '', error || '');
        break;
      case LogLevel.INFO:
        console.info(logMessage, context || '', error || '');
        break;
      case LogLevel.WARN:
        console.warn(logMessage, context || '', error || '');
        break;
      case LogLevel.ERROR:
      case LogLevel.CRITICAL:
        console.error(logMessage, context || '', error || '');
        break;
      default:
        console.log(logMessage, context || '', error || '');
    }
  }

  private sendToExternalServices(logEntry: LogEntry): void {
    // In a real application, this would send logs to services like:
    // Sentry, Datadog, New Relic, ELK Stack, etc.
    if (process.env.NODE_ENV === 'production') {
      // Example: send to a hypothetical API endpoint
      // fetch('/api/logs', {
      //   method: 'POST',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify(logEntry),
      // }).catch(err => console.error('Failed to send log to external service:', err));
    }
  }
}

// Export a singleton instance of the LoggingService
export const logger = new LoggingService(process.env.NODE_ENV === 'production' ? LogLevel.INFO : LogLevel.DEBUG);
