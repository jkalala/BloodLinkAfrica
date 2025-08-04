import { SecurityMonitor, SecurityEventType, RiskLevel } from '../../lib/security-monitoring';
import { createServerSupabaseClient } from '../../lib/supabase';

// Mock the entire supabase module
jest.mock('../../lib/supabase', () => {
  const mockSupabase = {
    from: jest.fn().mockReturnThis(),
    insert: jest.fn().mockResolvedValue({ error: null }),
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    gte: jest.fn().mockReturnThis(),
    single: jest.fn().mockResolvedValue({ data: null, error: null }),
    rpc: jest.fn().mockResolvedValue({ data: [], error: null }),
  };
  return {
    createServerSupabaseClient: jest.fn(() => mockSupabase),
  };
});



  describe('logSecurityEvent', () => {
    it('should log a security event successfully', async () => {
      const event = {
        event_type: SecurityEventType.LOGIN_SUCCESS,
        risk_level: RiskLevel.LOW,
        user_id: 'test-user-id',
        ip_address: '192.168.1.1',
        user_agent: 'Mozilla/5.0',
        details: { test: 'data' },
      };

      await securityMonitor.logSecurityEvent(event);

      expect(mockSupabase.from).toHaveBeenCalledWith('security_events');
      expect(mockSupabase.insert).toHaveBeenCalledWith([
        expect.objectContaining({
          event_type: SecurityEventType.LOGIN_SUCCESS,
          risk_level: RiskLevel.LOW,
          user_id: 'test-user-id',
          ip_address: '192.168.1.1',
          user_agent: 'Mozilla/5.0',
          details: { test: 'data' },
          resolved: false,
          timestamp: expect.any(String),
        }),
      ]);
    });

    it('should handle database errors gracefully', async () => {
      mockSupabase.insert.mockResolvedValueOnce({ error: new Error('Database error') });
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      const event = {
        event_type: SecurityEventType.LOGIN_FAILURE,
        risk_level: RiskLevel.MEDIUM,
        details: {},
      };

      await expect(securityMonitor.logSecurityEvent(event)).resolves.not.toThrow();
      expect(consoleSpy).toHaveBeenCalledWith('Failed to log security event:', expect.any(Error));

      consoleSpy.mockRestore();
    });
  });

  describe('analyzeInput', () => {
    it('should detect SQL injection attempts', () => {
      const maliciousInput = "'; DROP TABLE users; --";
      const result = securityMonitor.analyzeInput(maliciousInput);

      expect(result.threats).toContain('SQL Injection');
      expect(result.riskLevel).toBe(RiskLevel.HIGH);
    });

    it('should detect XSS attempts', () => {
      const maliciousInput = '<script>alert("xss")</script>';
      const result = securityMonitor.analyzeInput(maliciousInput);

      expect(result.threats).toContain('XSS Attempt');
      expect(result.riskLevel).toBe(RiskLevel.MEDIUM);
    });

    it('should detect path traversal attempts', () => {
      const maliciousInput = '../../../etc/passwd';
      const result = securityMonitor.analyzeInput(maliciousInput);

      expect(result.threats).toContain('Path Traversal');
      expect(result.riskLevel).toBe(RiskLevel.HIGH);
    });

    it('should detect command injection attempts', () => {
      const maliciousInput = 'test; rm -rf /';
      const result = securityMonitor.analyzeInput(maliciousInput);

      expect(result.threats).toContain('Command Injection');
      expect(result.riskLevel).toBe(RiskLevel.HIGH);
    });

    it('should detect suspicious user agents', () => {
      const suspiciousInput = 'bot crawler scanner';
      const result = securityMonitor.analyzeInput(suspiciousInput);

      expect(result.threats).toContain('Suspicious User Agent');
      expect(result.riskLevel).toBe(RiskLevel.LOW);
    });

    it('should return no threats for clean input', () => {
      const cleanInput = 'This is a normal user input';
      const result = securityMonitor.analyzeInput(cleanInput);

      expect(result.threats).toHaveLength(0);
      expect(result.riskLevel).toBe(RiskLevel.LOW);
    });

    it('should log threats when found', async () => {
      const maliciousInput = '<script>alert(1)</script>';
      
      securityMonitor.analyzeInput(maliciousInput, 'test-context');

      expect(mockSupabase.from).toHaveBeenCalledWith('security_events');
      expect(mockSupabase.insert).toHaveBeenCalledWith([
        expect.objectContaining({
          event_type: SecurityEventType.MALICIOUS_INPUT_DETECTED,
          risk_level: RiskLevel.MEDIUM,
          details: expect.objectContaining({
            input: maliciousInput,
            threats: ['XSS Attempt'],
            context: 'test-context',
          }),
        }),
      ]);
    });
  });

  describe('trackUserActivity', () => {
    it('should track normal user activity', async () => {
      await securityMonitor.trackUserActivity('user-123', 'login_attempt', { ip: '192.168.1.1' });

      // Should not trigger any security events for normal activity
      expect(mockSupabase.insert).not.toHaveBeenCalled();
    });

    it('should detect suspicious activity patterns', async () => {
      const userId = 'user-123';
      const activity = 'login_attempt';

      // Simulate multiple rapid attempts (exceeding threshold      for (let i = 0; i < 6; i++) {
        await securityMonitor.trackUserActivity(userId, activity);
      }

      expect(mockSupabase.insert).toHaveBeenCalledWith([
        expect.objectContaining({
          event_type: SecurityEventType.SUSPICIOUS_ACTIVITY,
          risk_level: RiskLevel.MEDIUM,
          user_id: userId,
          details: expect.objectContaining({
            activity,
            count: 6,
            threshold: 5,
          }),
        }),
      ]);
    });
  });

  describe('trackFailedLogin', () => {
    it('should log failed login attempts', async () => {
      await securityMonitor.trackFailedLogin('test@example.com', '192.168.1.1', 'Mozilla/5.0');

      expect(mockSupabase.insert).toHaveBeenCalledWith([
        expect.objectContaining({
          event_type: SecurityEventType.LOGIN_FAILURE,
          risk_level: RiskLevel.LOW,
          ip_address: '192.168.1.1',
          user_agent: 'Mozilla/5.0',
          details: expect.objectContaining({
            identifier: 'test@example.com',
            attempt_count: 1,
          }),
        }),
      ]);
    });

    it('should escalate risk level after multiple failures', async () => {
      const identifier = 'test@example.com';
      const ipAddress = '192.168.1.1';

      // Simulate multiple failed attempts
      for (let i = 0; i < 6; i++) {
        await securityMonitor.trackFailedLogin(identifier, ipAddress);
      }

      // The 6th attempt should be marked as high risk
      expect(mockSupabase.insert).toHaveBeenLastCalledWith([
        expect.objectContaining({
          event_type: SecurityEventType.LOGIN_FAILURE,
          risk_level: RiskLevel.HIGH,
          details: expect.objectContaining({
            attempt_count: 6,
          }),
        }),
      ]);
    });

    it('should lock account after too many failures', async () => {
      const identifier = 'test@example.com';
      const ipAddress = '192.168.1.1';

      // Simulate 10 failed attempts to trigger account lock
      for (let i = 0; i < 10; i++) {
        await securityMonitor.trackFailedLogin(identifier, ipAddress);
      }

      // Should log account lock event
      expect(mockSupabase.insert).toHaveBeenCalledWith([
        expect.objectContaining({
          event_type: SecurityEventType.ACCOUNT_LOCKED,
          risk_level: RiskLevel.HIGH,
          details: expect.objectContaining({
            identifier,
            reason: 'Multiple failed login attempts',
            attempt_count: 10,
          }),
        }),
      ]);
    });
  });

  describe('trackSuccessfulLogin', () => {
    it('should log successful login', async () => {
      await securityMonitor.trackSuccessfulLogin('user-123', '192.168.1.1', 'Mozilla/5.0');

      expect(mockSupabase.insert).toHaveBeenCalledWith([
        expect.objectContaining({
          event_type: SecurityEventType.LOGIN_SUCCESS,
          risk_level: RiskLevel.LOW,
          user_id: 'user-123',
          ip_address: '192.168.1.1',
          user_agent: 'Mozilla/5.0',
        }),
      ]);
    });
  });

  describe('trackApiUsage', () => {
    it('should track regular API usage', async () => {
      await securityMonitor.trackApiUsage('/api/users', 'GET', 'user-123', '192.168.1.1');

      // Regular API usage should not trigger security events
      expect(mockSupabase.insert).not.toHaveBeenCalled();
    });

    it('should log high-risk API access', async () => {
      await securityMonitor.trackApiUsage('/api/admin/users', 'DELETE', 'user-123', '192.168.1.1');

      expect(mockSupabase.insert).toHaveBeenCalledWith([
        expect.objectContaining({
          event_type: SecurityEventType.SENSITIVE_DATA_ACCESS,
          risk_level: RiskLevel.MEDIUM,
          user_id: 'user-123',
          endpoint: '/api/admin/users',
          method: 'DELETE',
        }),
      ]);
    });
  });

  describe('getSecurityMetrics', () => {
    beforeEach(() => {
      mockSupabase.select.mockReturnThis();
      mockSupabase.gte.mockResolvedValue({ 
        data: [
          { event_type: 'login_failure', risk_level: 'high', ip_address: '192.168.1.1' },
          { event_type: 'login_failure', risk_level: 'medium', ip_address: '192.168.1.1' },
          { event_type: 'xss_attempt', risk_level: 'high', ip_address: '192.168.1.2' },
        ], 
        error: null, 
      });
    });

    it('should return security metrics', async () => {
      const metrics = await securityMonitor.getSecurityMetrics('24h');

      expect(metrics.totalEvents).toBe(3);
      expect(metrics.eventsByType).toEqual({
        'login_failure': 2,
        'xss_attempt': 1,
      });
      expect(metrics.eventsByRisk).toEqual({
        'high': 2,
        'medium': 1,
      });
      expect(metrics.topThreats).toEqual([
        { type: 'login_failure', count: 2 },
        { type: 'xss_attempt', count: 1 },
      ]);
      expect(metrics.suspiciousIPs).toEqual([
        { ip: '192.168.1.1', events: 2 },
      ]);
    });

    it('should handle database errors gracefully', async () => {
      mockSupabase.gte.mockResolvedValueOnce({ data: null, error: new Error('DB Error') });

      const metrics = await securityMonitor.getSecurityMetrics('1h');

      expect(metrics.totalEvents).toBe(0);
      expect(metrics.eventsByType).toEqual({});
      expect(metrics.eventsByRisk).toEqual({});
      expect(metrics.topThreats).toEqual([]);
      expect(metrics.suspiciousIPs).toEqual([]);
    });
  }