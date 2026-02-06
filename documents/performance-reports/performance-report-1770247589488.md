# Performance Test Report

**Generated:** 2026-02-04T23:26:29.454Z

## Summary

- Total Tests: 5
- ✅ Passed: 1
- ⚠️  Warnings: 4
- ❌ Failed: 0

## Test Results

### Database Query Optimization

**Status:** ⚠️ Warning

**Details:**
```json
{
  "totalFilesWithSelectAll": 2,
  "files": [
    {
      "file": "\\src\\app\\dashboard\\page.tsx",
      "count": 1
    },
    {
      "file": "\\src\\app\\dashboard\\system-management\\region\\page.tsx",
      "count": 1
    }
  ]
}
```

### Client Component Size Analysis

**Status:** ⚠️ Warning

**Details:**
```json
{
  "totalClientComponents": 27,
  "largeComponents": [
    {
      "file": "\\src\\app\\dashboard\\system-management\\cameras\\camera-management-content-new.tsx",
      "lines": 548,
      "size": 24146
    }
  ]
}
```

### React.memo Optimization

**Status:** ⚠️ Warning

**Details:**
```json
{
  "componentsWithoutMemo": 19,
  "files": [
    {
      "file": "\\src\\app\\dashboard\\admin\\admin-tabs.tsx"
    },
    {
      "file": "\\src\\app\\dashboard\\admin\\employees\\reset-password-button.tsx"
    },
    {
      "file": "\\src\\app\\dashboard\\error-signout.tsx"
    },
    {
      "file": "\\src\\app\\dashboard\\finance\\demands\\demand-actions.tsx"
    },
    {
      "file": "\\src\\app\\dashboard\\sales\\demands\\new\\demand-form.tsx"
    },
    {
      "file": "\\src\\app\\dashboard\\sidebar.tsx"
    },
    {
      "file": "\\src\\app\\dashboard\\specialist\\work\\work-actions.tsx"
    },
    {
      "file": "\\src\\app\\dashboard\\system-management\\api\\api-management-content.tsx"
    },
    {
      "file": "\\src\\app\\dashboard\\system-management\\database\\database-management-content.tsx"
    },
    {
      "file": "\\src\\app\\dashboard\\system-management\\dealer\\dealer-management-content.tsx"
    }
  ]
}
```

### Dynamic Import Optimization

**Status:** ⚠️ Warning

**Details:**
```json
{
  "filesWithHeavyImports": 24,
  "files": [
    {
      "file": "\\src\\app\\dashboard\\admin\\admin-tabs.tsx",
      "pattern": "/import.*from.*['\"]lucide-react['\"]/"
    },
    {
      "file": "\\src\\app\\dashboard\\admin\\demands\\page.tsx",
      "pattern": "/import.*from.*['\"]date-fns['\"]/"
    },
    {
      "file": "\\src\\app\\dashboard\\admin\\demands\\[id]\\page.tsx",
      "pattern": "/import.*from.*['\"]lucide-react['\"]/"
    },
    {
      "file": "\\src\\app\\dashboard\\admin\\demands\\[id]\\page.tsx",
      "pattern": "/import.*from.*['\"]date-fns['\"]/"
    },
    {
      "file": "\\src\\app\\dashboard\\admin\\employees\\reset-password-button.tsx",
      "pattern": "/import.*from.*['\"]lucide-react['\"]/"
    },
    {
      "file": "\\src\\app\\dashboard\\admin\\employees\\[id]\\page.tsx",
      "pattern": "/import.*from.*['\"]lucide-react['\"]/"
    },
    {
      "file": "\\src\\app\\dashboard\\admin\\employees\\[id]\\page.tsx",
      "pattern": "/import.*from.*['\"]date-fns['\"]/"
    },
    {
      "file": "\\src\\app\\dashboard\\admin\\reports\\page.tsx",
      "pattern": "/import.*from.*['\"]date-fns['\"]/"
    },
    {
      "file": "\\src\\app\\dashboard\\finance\\demands\\actions.ts",
      "pattern": "/import.*from.*['\"]date-fns['\"]/"
    },
    {
      "file": "\\src\\app\\dashboard\\finance\\demands\\page.tsx",
      "pattern": "/import.*from.*['\"]date-fns['\"]/"
    }
  ]
}
```

### Next.js Configuration

**Status:** ✅ Passed

**Details:**
```json
{
  "compress": true,
  "images": true,
  "optimizePackageImports": true
}
```

## Recommendations

1. **[MEDIUM]** Found 2 files using select('*'). Consider selecting only required columns for better performance.
   - Files: \src\app\dashboard\page.tsx, \src\app\dashboard\system-management\region\page.tsx

2. **[MEDIUM]** Found 1 large client components (>500 lines or >50KB). Consider code splitting.
   - Files: \src\app\dashboard\system-management\cameras\camera-management-content-new.tsx

3. **[LOW]** Found 19 client components that could benefit from React.memo for re-render optimization.

4. **[LOW]** Found 24 files with heavy imports that could benefit from dynamic imports.

