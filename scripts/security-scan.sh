#!/bin/bash

# Automated Security Scanning Script for BloodConnectv0
# This script performs automated security checks and vulnerability scanning

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
PROJECT_ROOT="$(pwd)"
SCAN_RESULTS_DIR="$PROJECT_ROOT/security-scan-results"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
REPORT_FILE="$SCAN_RESULTS_DIR/security_scan_$TIMESTAMP.md"

# Create results directory
mkdir -p "$SCAN_RESULTS_DIR"

echo -e "${BLUE}🔒 Starting Automated Security Scan for BloodConnectv0${NC}"
echo "=================================================================="
echo "Scan started at: $(date)"
echo "Results will be saved to: $REPORT_FILE"
echo ""

# Initialize report
cat > "$REPORT_FILE" << EOF
# Security Scan Report

**Project**: BloodConnectv0  
**Scan Date**: $(date)  
**Scan Type**: Automated Security Analysis

## Executive Summary

This report contains the results of automated security scanning performed on the BloodConnectv0 application.

## Scan Results

EOF

# Function to log results
log_result() {
    local status=$1
    local message=$2
    local details=$3
    
    echo -e "$message"
    
    cat >> "$REPORT_FILE" << EOF

### $message

**Status**: $status  
**Details**: $details

EOF
}

# Function to run command and capture output
run_scan() {
    local command=$1
    local description=$2
    
    echo -e "${BLUE}Running: $description${NC}"
    
    if eval "$command" > /tmp/scan_output.txt 2>&1; then
        local result=$(cat /tmp/scan_output.txt)
        log_result "✅ PASSED" "$description" "$result"
        return 0
    else
        local result=$(cat /tmp/scan_output.txt)
        log_result "❌ FAILED" "$description" "$result"
        return 1
    fi
}

# Counter for issues
CRITICAL_ISSUES=0
HIGH_ISSUES=0
MEDIUM_ISSUES=0
LOW_ISSUES=0

# 1. Check for hardcoded secrets
echo -e "${YELLOW}1. Scanning for hardcoded secrets...${NC}"
SECRET_PATTERNS=(
    "sk_[a-zA-Z0-9]{48}"
    "pk_[a-zA-Z0-9]{48}"
    "AIza[0-9A-Za-z\\-_]{35}"
    "ya29\\.[0-9A-Za-z\\-_]+"
    "[a-zA-Z0-9]{40}"
    "(?i)(password|passwd|pwd)\\s*[:=]\\s*['\"][^'\"]{8,}['\"]"
    "(?i)(api[_-]?key|apikey)\\s*[:=]\\s*['\"][^'\"]{10,}['\"]"
    "(?i)(secret[_-]?key|secretkey)\\s*[:=]\\s*['\"][^'\"]{10,}['\"]"
)

SECRETS_FOUND=0
for pattern in "${SECRET_PATTERNS[@]}"; do
    if grep -r -E "$pattern" . --exclude-dir=node_modules --exclude-dir=.git --exclude-dir=security-scan-results > /tmp/secrets.txt 2>/dev/null; then
        SECRETS_FOUND=$((SECRETS_FOUND + 1))
        CRITICAL_ISSUES=$((CRITICAL_ISSUES + 1))
    fi
done

if [ $SECRETS_FOUND -eq 0 ]; then
    log_result "✅ PASSED" "Hardcoded Secrets Scan" "No hardcoded secrets detected"
else
    log_result "❌ CRITICAL" "Hardcoded Secrets Scan" "Found $SECRETS_FOUND potential secrets. Check /tmp/secrets.txt for details."
fi

# 2. Dependency vulnerability scan
echo -e "${YELLOW}2. Scanning for dependency vulnerabilities...${NC}"
if command -v pnpm &> /dev/null; then
    if pnpm audit --json > /tmp/audit.json 2>/dev/null; then
        AUDIT_SUMMARY=$(pnpm audit 2>/dev/null | tail -5)
        log_result "✅ PASSED" "Dependency Vulnerability Scan" "$AUDIT_SUMMARY"
    else
        AUDIT_RESULT=$(pnpm audit 2>&1 || true)
        if echo "$AUDIT_RESULT" | grep -q "vulnerabilities"; then
            HIGH_ISSUES=$((HIGH_ISSUES + 1))
            log_result "⚠️ HIGH" "Dependency Vulnerability Scan" "$AUDIT_RESULT"
        else
            log_result "✅ PASSED" "Dependency Vulnerability Scan" "No vulnerabilities found"
        fi
    fi
else
    log_result "⚠️ MEDIUM" "Dependency Vulnerability Scan" "pnpm not found, cannot scan dependencies"
    MEDIUM_ISSUES=$((MEDIUM_ISSUES + 1))
fi

# 3. TypeScript security check
echo -e "${YELLOW}3. Running TypeScript security checks...${NC}"
if command -v npx &> /dev/null; then
    if npx tsc --noEmit > /tmp/tsc.txt 2>&1; then
        log_result "✅ PASSED" "TypeScript Security Check" "No type errors found"
    else
        TYPE_ERRORS=$(cat /tmp/tsc.txt | wc -l)
        MEDIUM_ISSUES=$((MEDIUM_ISSUES + 1))
        log_result "⚠️ MEDIUM" "TypeScript Security Check" "Found $TYPE_ERRORS type-related issues. See /tmp/tsc.txt"
    fi
else
    log_result "⚠️ LOW" "TypeScript Security Check" "npx not available"
    LOW_ISSUES=$((LOW_ISSUES + 1))
fi

# 4. Check for insecure HTTP URLs
echo -e "${YELLOW}4. Scanning for insecure HTTP URLs...${NC}"
HTTP_URLS=$(grep -r "http://" . --exclude-dir=node_modules --exclude-dir=.git --exclude-dir=security-scan-results | wc -l)
if [ $HTTP_URLS -eq 0 ]; then
    log_result "✅ PASSED" "Insecure HTTP URLs" "No insecure HTTP URLs found"
else
    MEDIUM_ISSUES=$((MEDIUM_ISSUES + 1))
    log_result "⚠️ MEDIUM" "Insecure HTTP URLs" "Found $HTTP_URLS instances of HTTP URLs. Consider using HTTPS."
fi

# 5. Check for console.log statements (potential information disclosure)
echo -e "${YELLOW}5. Scanning for console.log statements...${NC}"
CONSOLE_LOGS=$(grep -r "console\.log" . --include="*.ts" --include="*.tsx" --include="*.js" --include="*.jsx" --exclude-dir=node_modules --exclude-dir=.git --exclude-dir=security-scan-results | wc -l)
if [ $CONSOLE_LOGS -eq 0 ]; then
    log_result "✅ PASSED" "Console Log Statements" "No console.log statements found"
elif [ $CONSOLE_LOGS -lt 10 ]; then
    LOW_ISSUES=$((LOW_ISSUES + 1))
    log_result "⚠️ LOW" "Console Log Statements" "Found $CONSOLE_LOGS console.log statements. Review for sensitive data exposure."
else
    MEDIUM_ISSUES=$((MEDIUM_ISSUES + 1))
    log_result "⚠️ MEDIUM" "Console Log Statements" "Found $CONSOLE_LOGS console.log statements. Many console.log statements may expose sensitive information."
fi

# 6. Check for SQL injection patterns
echo -e "${YELLOW}6. Scanning for potential SQL injection vulnerabilities...${NC}"
SQL_PATTERNS=(
    "\\$\\{[^}]*\\}.*SELECT"
    "\\+.*SELECT.*FROM"
    "query.*\\+.*['\"]"
    "\\\`.*\\$\\{.*\\}.*\\\`"
)

SQL_ISSUES=0
for pattern in "${SQL_PATTERNS[@]}"; do
    if grep -r -E "$pattern" . --include="*.ts" --include="*.js" --exclude-dir=node_modules --exclude-dir=.git --exclude-dir=security-scan-results > /dev/null 2>&1; then
        SQL_ISSUES=$((SQL_ISSUES + 1))
    fi
done

if [ $SQL_ISSUES -eq 0 ]; then
    log_result "✅ PASSED" "SQL Injection Pattern Scan" "No potential SQL injection patterns detected"
else
    HIGH_ISSUES=$((HIGH_ISSUES + 1))
    log_result "❌ HIGH" "SQL Injection Pattern Scan" "Found $SQL_ISSUES potential SQL injection patterns. Review query construction."
fi

# 7. Check for XSS vulnerabilities
echo -e "${YELLOW}7. Scanning for potential XSS vulnerabilities...${NC}"
XSS_PATTERNS=(
    "dangerouslySetInnerHTML"
    "innerHTML.*=.*['\"].*\\$"
    "document\\.write.*\\$"
    "eval\\("
)

XSS_ISSUES=0
for pattern in "${XSS_PATTERNS[@]}"; do
    if grep -r -E "$pattern" . --include="*.ts" --include="*.tsx" --include="*.js" --include="*.jsx" --exclude-dir=node_modules --exclude-dir=.git --exclude-dir=security-scan-results > /dev/null 2>&1; then
        XSS_ISSUES=$((XSS_ISSUES + 1))
    fi
done

if [ $XSS_ISSUES -eq 0 ]; then
    log_result "✅ PASSED" "XSS Vulnerability Scan" "No potential XSS patterns detected"
else
    HIGH_ISSUES=$((HIGH_ISSUES + 1))
    log_result "❌ HIGH" "XSS Vulnerability Scan" "Found $XSS_ISSUES potential XSS patterns. Review HTML rendering and user input handling."
fi

# 8. Check for proper environment variable usage
echo -e "${YELLOW}8. Checking environment variable security...${NC}"
ENV_ISSUES=0

# Check for process.env usage outside of server-side code
if grep -r "process\.env" . --include="*.tsx" --exclude-dir=node_modules --exclude-dir=.git --exclude-dir=security-scan-results | grep -v "NEXT_PUBLIC_" > /dev/null 2>&1; then
    ENV_ISSUES=$((ENV_ISSUES + 1))
fi

# Check for missing NEXT_PUBLIC_ prefix in client-side env vars
if grep -r "process\.env\." . --include="*.tsx" --exclude-dir=node_modules --exclude-dir=.git --exclude-dir=security-scan-results | grep -v "NEXT_PUBLIC_\|\.ts:\|server\|api" > /dev/null 2>&1; then
    ENV_ISSUES=$((ENV_ISSUES + 1))
fi

if [ $ENV_ISSUES -eq 0 ]; then
    log_result "✅ PASSED" "Environment Variable Security" "Proper environment variable usage detected"
else
    MEDIUM_ISSUES=$((MEDIUM_ISSUES + 1))
    log_result "⚠️ MEDIUM" "Environment Variable Security" "Found $ENV_ISSUES potential environment variable security issues"
fi

# 9. Check for weak cryptographic practices
echo -e "${YELLOW}9. Scanning for weak cryptographic practices...${NC}"
CRYPTO_ISSUES=0

# Check for weak hashing algorithms
if grep -r -E "(md5|sha1)[^a-zA-Z]" . --include="*.ts" --include="*.js" --exclude-dir=node_modules --exclude-dir=.git --exclude-dir=security-scan-results > /dev/null 2>&1; then
    CRYPTO_ISSUES=$((CRYPTO_ISSUES + 1))
fi

# Check for hardcoded crypto keys/salts
if grep -r -E "(salt|key).*['\"][a-zA-Z0-9]{16,}['\"]" . --include="*.ts" --include="*.js" --exclude-dir=node_modules --exclude-dir=.git --exclude-dir=security-scan-results > /dev/null 2>&1; then
    CRYPTO_ISSUES=$((CRYPTO_ISSUES + 1))
fi

if [ $CRYPTO_ISSUES -eq 0 ]; then
    log_result "✅ PASSED" "Cryptographic Practices Scan" "No weak cryptographic practices detected"
else
    HIGH_ISSUES=$((HIGH_ISSUES + 1))
    log_result "❌ HIGH" "Cryptographic Practices Scan" "Found $CRYPTO_ISSUES potential weak cryptographic practices"
fi

# 10. Check file permissions
echo -e "${YELLOW}10. Checking file permissions...${NC}"
PERM_ISSUES=0

# Check for overly permissive files
if find . -type f -perm -o+w ! -path "./node_modules/*" ! -path "./.git/*" ! -path "./security-scan-results/*" | head -1 > /dev/null 2>&1; then
    PERM_ISSUES=$((PERM_ISSUES + 1))
fi

# Check for executable files that shouldn't be
if find . -name "*.json" -o -name "*.md" -o -name "*.txt" | xargs ls -l | grep "^-.*x" > /dev/null 2>&1; then
    PERM_ISSUES=$((PERM_ISSUES + 1))
fi

if [ $PERM_ISSUES -eq 0 ]; then
    log_result "✅ PASSED" "File Permissions Check" "No file permission issues detected"
else
    LOW_ISSUES=$((LOW_ISSUES + 1))
    log_result "⚠️ LOW" "File Permissions Check" "Found $PERM_ISSUES file permission issues"
fi

# Generate summary
echo ""
echo -e "${BLUE}📊 Scan Summary${NC}"
echo "=================================================================="
echo -e "Critical Issues: ${RED}$CRITICAL_ISSUES${NC}"
echo -e "High Issues: ${YELLOW}$HIGH_ISSUES${NC}"
echo -e "Medium Issues: ${YELLOW}$MEDIUM_ISSUES${NC}"
echo -e "Low Issues: ${GREEN}$LOW_ISSUES${NC}"
echo ""

# Add summary to report
cat >> "$REPORT_FILE" << EOF

## Scan Summary

| Severity | Count |
|----------|-------|
| Critical | $CRITICAL_ISSUES |
| High     | $HIGH_ISSUES |
| Medium   | $MEDIUM_ISSUES |
| Low      | $LOW_ISSUES |

## Recommendations

### Critical Issues
$(if [ $CRITICAL_ISSUES -gt 0 ]; then echo "- **Immediate Action Required**: Address all critical issues before deployment"; else echo "- No critical issues found ✅"; fi)

### High Issues  
$(if [ $HIGH_ISSUES -gt 0 ]; then echo "- **High Priority**: Review and fix high-severity issues within 24 hours"; else echo "- No high-severity issues found ✅"; fi)

### Medium Issues
$(if [ $MEDIUM_ISSUES -gt 0 ]; then echo "- **Medium Priority**: Address medium-severity issues in the next development cycle"; else echo "- No medium-severity issues found ✅"; fi)

### Low Issues
$(if [ $LOW_ISSUES -gt 0 ]; then echo "- **Low Priority**: Address low-severity issues during regular maintenance"; else echo "- No low-severity issues found ✅"; fi)

## Next Steps

1. Review this report and prioritize fixes based on severity
2. Address critical and high-severity issues immediately
3. Plan remediation for medium and low-severity issues
4. Run this scan regularly (recommended: before each deployment)
5. Update security policies and procedures based on findings

---

**Scan completed at**: $(date)  
**Report generated by**: BloodConnectv0 Automated Security Scanner
EOF

# Determine exit code based on severity
TOTAL_CRITICAL_HIGH=$((CRITICAL_ISSUES + HIGH_ISSUES))

if [ $TOTAL_CRITICAL_HIGH -gt 0 ]; then
    echo -e "${RED}❌ SECURITY SCAN FAILED${NC}"
    echo "Found $TOTAL_CRITICAL_HIGH critical/high severity issues that must be addressed."
    echo "Report saved to: $REPORT_FILE"
    exit 1
else
    echo -e "${GREEN}✅ SECURITY SCAN PASSED${NC}"
    echo "No critical or high-severity security issues found."
    echo "Report saved to: $REPORT_FILE"
    exit 0
fi