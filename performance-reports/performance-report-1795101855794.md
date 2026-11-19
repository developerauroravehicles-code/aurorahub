# Performance Test Report

**Generated:** 2026-11-19T15:24:15.558Z

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
  "totalFilesWithSelectAll": 20,
  "files": [
    {
      "file": "\\src\\app\\api\\customer-portal\\service-record\\route.ts",
      "count": 1
    },
    {
      "file": "\\src\\app\\api\\field\\jobs\\[id]\\start\\route.ts",
      "count": 3
    },
    {
      "file": "\\src\\app\\dashboard\\admin\\employees\\expense-claim-actions.ts",
      "count": 1
    },
    {
      "file": "\\src\\app\\dashboard\\admin\\service-records\\actions.ts",
      "count": 4
    },
    {
      "file": "\\src\\app\\dashboard\\admin\\service-records\\page.tsx",
      "count": 1
    },
    {
      "file": "\\src\\app\\dashboard\\communication\\actions.ts",
      "count": 5
    },
    {
      "file": "\\src\\app\\dashboard\\hr\\compliance\\page.tsx",
      "count": 1
    },
    {
      "file": "\\src\\app\\dashboard\\hr\\equipment\\page.tsx",
      "count": 1
    },
    {
      "file": "\\src\\app\\dashboard\\hr\\payroll\\actions.ts",
      "count": 1
    },
    {
      "file": "\\src\\app\\dashboard\\hr\\personnel\\[id]\\page.tsx",
      "count": 3
    },
    {
      "file": "\\src\\app\\dashboard\\hr\\training\\page.tsx",
      "count": 1
    },
    {
      "file": "\\src\\app\\dashboard\\integrations\\external-apis\\external-apis-content.tsx",
      "count": 2
    },
    {
      "file": "\\src\\app\\dashboard\\specialist\\service-records\\actions.ts",
      "count": 2
    },
    {
      "file": "\\src\\app\\dashboard\\system-management\\groups\\actions.ts",
      "count": 1
    },
    {
      "file": "\\src\\components\\dashboard\\dashboard-notification-bell.tsx",
      "count": 1
    },
    {
      "file": "\\src\\lib\\inventory-barcodes\\assign.ts",
      "count": 3
    },
    {
      "file": "\\src\\lib\\inventory-barcodes\\consume.ts",
      "count": 3
    },
    {
      "file": "\\src\\lib\\inventory-barcodes\\generate.ts",
      "count": 2
    },
    {
      "file": "\\src\\lib\\inventory-barcodes\\register-existing.ts",
      "count": 1
    },
    {
      "file": "\\src\\lib\\self\\expenses.ts",
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
  "totalClientComponents": 193,
  "largeComponents": [
    {
      "file": "\\src\\app\\dashboard\\admin\\customers\\customers-directory-list.tsx",
      "lines": 523,
      "size": 22998
    },
    {
      "file": "\\src\\app\\dashboard\\admin\\daily-invoices\\daily-invoices-content.tsx",
      "lines": 603,
      "size": 24779
    },
    {
      "file": "\\src\\app\\dashboard\\admin\\demands\\create-external-demand-form.tsx",
      "lines": 1220,
      "size": 48184
    },
    {
      "file": "\\src\\app\\dashboard\\admin\\demands\\demands-list.tsx",
      "lines": 514,
      "size": 21122
    },
    {
      "file": "\\src\\app\\dashboard\\admin\\inventory\\inventory-barcode-panel.tsx",
      "lines": 1001,
      "size": 40692
    },
    {
      "file": "\\src\\app\\dashboard\\admin\\inventory\\inventory-dashboard.tsx",
      "lines": 1192,
      "size": 50104
    },
    {
      "file": "\\src\\app\\dashboard\\admin\\invoices\\invoice-preview-editor.tsx",
      "lines": 523,
      "size": 22513
    },
    {
      "file": "\\src\\app\\dashboard\\admin\\invoices\\invoice-table.tsx",
      "lines": 1095,
      "size": 55183
    },
    {
      "file": "\\src\\app\\dashboard\\admin\\reports\\page.tsx",
      "lines": 652,
      "size": 30734
    },
    {
      "file": "\\src\\app\\dashboard\\admin\\service-records\\service-records-content.tsx",
      "lines": 667,
      "size": 28820
    },
    {
      "file": "\\src\\app\\dashboard\\hr\\compliance\\compliance-document-panels.tsx",
      "lines": 630,
      "size": 26048
    },
    {
      "file": "\\src\\app\\dashboard\\hr\\payroll\\payroll-content.tsx",
      "lines": 946,
      "size": 53930
    },
    {
      "file": "\\src\\app\\dashboard\\hr\\performance\\performance-content.tsx",
      "lines": 555,
      "size": 30872
    },
    {
      "file": "\\src\\app\\dashboard\\hr\\personnel\\[id]\\personnel-detail.tsx",
      "lines": 1017,
      "size": 57150
    },
    {
      "file": "\\src\\app\\dashboard\\hr\\training\\training-content.tsx",
      "lines": 566,
      "size": 26662
    },
    {
      "file": "\\src\\app\\dashboard\\self\\self-portal-content.tsx",
      "lines": 781,
      "size": 44339
    },
    {
      "file": "\\src\\app\\dashboard\\system-management\\automation\\automation-content.tsx",
      "lines": 710,
      "size": 33978
    },
    {
      "file": "\\src\\app\\dashboard\\system-management\\calendar\\scheduling-pools-panel.tsx",
      "lines": 539,
      "size": 23115
    },
    {
      "file": "\\src\\app\\dashboard\\system-management\\cameras\\camera-management-content-new.tsx",
      "lines": 736,
      "size": 32700
    },
    {
      "file": "\\src\\app\\dashboard\\system-management\\logs\\logs-content.tsx",
      "lines": 545,
      "size": 26415
    },
    {
      "file": "\\src\\app\\dashboard\\system-management\\service-desk\\service-desk-content.tsx",
      "lines": 1475,
      "size": 71443
    },
    {
      "file": "\\src\\app\\dashboard\\system-management\\sms\\sms-management-content.tsx",
      "lines": 744,
      "size": 37327
    },
    {
      "file": "\\src\\app\\dashboard\\system-management\\user\\user-management-content.tsx",
      "lines": 755,
      "size": 31570
    },
    {
      "file": "\\src\\components\\communication\\meet\\meet-room-content.tsx",
      "lines": 690,
      "size": 26878
    },
    {
      "file": "\\src\\components\\email-compose-modal.tsx",
      "lines": 530,
      "size": 18823
    }
  ]
}
```

### React.memo Optimization

**Status:** ⚠️ Warning

**Details:**
```json
{
  "componentsWithoutMemo": 182,
  "files": [
    {
      "file": "\\src\\app\\customer-portal\\components\\appointment-panel.tsx"
    },
    {
      "file": "\\src\\app\\customer-portal\\components\\camera-info-panel.tsx"
    },
    {
      "file": "\\src\\app\\customer-portal\\components\\dashcam-qr-section.tsx"
    },
    {
      "file": "\\src\\app\\customer-portal\\components\\dealer-contact-panel.tsx"
    },
    {
      "file": "\\src\\app\\customer-portal\\components\\documents-panel.tsx"
    },
    {
      "file": "\\src\\app\\customer-portal\\components\\handoff-complete-panel.tsx"
    },
    {
      "file": "\\src\\app\\customer-portal\\components\\installation-card.tsx"
    },
    {
      "file": "\\src\\app\\customer-portal\\components\\installation-list.tsx"
    },
    {
      "file": "\\src\\app\\customer-portal\\components\\portal-contact-panel.tsx"
    },
    {
      "file": "\\src\\app\\customer-portal\\components\\portal-faq.tsx"
    }
  ]
}
```

### Dynamic Import Optimization

**Status:** ⚠️ Warning

**Details:**
```json
{
  "filesWithHeavyImports": 146,
  "files": [
    {
      "file": "\\src\\app\\auth\\change-password\\change-password-client.tsx",
      "pattern": "/import.*from.*['\"]lucide-react['\"]/"
    },
    {
      "file": "\\src\\app\\customer-portal\\components\\appointment-panel.tsx",
      "pattern": "/import.*from.*['\"]lucide-react['\"]/"
    },
    {
      "file": "\\src\\app\\customer-portal\\components\\camera-info-panel.tsx",
      "pattern": "/import.*from.*['\"]lucide-react['\"]/"
    },
    {
      "file": "\\src\\app\\customer-portal\\components\\dealer-contact-panel.tsx",
      "pattern": "/import.*from.*['\"]lucide-react['\"]/"
    },
    {
      "file": "\\src\\app\\customer-portal\\components\\documents-panel.tsx",
      "pattern": "/import.*from.*['\"]lucide-react['\"]/"
    },
    {
      "file": "\\src\\app\\customer-portal\\components\\portal-contact-panel.tsx",
      "pattern": "/import.*from.*['\"]lucide-react['\"]/"
    },
    {
      "file": "\\src\\app\\customer-portal\\components\\portal-faq.tsx",
      "pattern": "/import.*from.*['\"]lucide-react['\"]/"
    },
    {
      "file": "\\src\\app\\customer-portal\\components\\progress-tracker.tsx",
      "pattern": "/import.*from.*['\"]lucide-react['\"]/"
    },
    {
      "file": "\\src\\app\\customer-portal\\components\\rating-panel.tsx",
      "pattern": "/import.*from.*['\"]lucide-react['\"]/"
    },
    {
      "file": "\\src\\app\\customer-portal\\components\\service-record-panel.tsx",
      "pattern": "/import.*from.*['\"]lucide-react['\"]/"
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

1. **[MEDIUM]** Found 20 files using select('*'). Consider selecting only required columns for better performance.
   - Files: \src\app\api\customer-portal\service-record\route.ts, \src\app\api\field\jobs\[id]\start\route.ts, \src\app\dashboard\admin\employees\expense-claim-actions.ts, \src\app\dashboard\admin\service-records\actions.ts, \src\app\dashboard\admin\service-records\page.tsx...

2. **[MEDIUM]** Found 25 large client components (>500 lines or >50KB). Consider code splitting.
   - Files: \src\app\dashboard\admin\customers\customers-directory-list.tsx, \src\app\dashboard\admin\daily-invoices\daily-invoices-content.tsx, \src\app\dashboard\admin\demands\create-external-demand-form.tsx, \src\app\dashboard\admin\demands\demands-list.tsx, \src\app\dashboard\admin\inventory\inventory-barcode-panel.tsx...

3. **[LOW]** Found 182 client components that could benefit from React.memo for re-render optimization.

4. **[LOW]** Found 146 files with heavy imports that could benefit from dynamic imports.

