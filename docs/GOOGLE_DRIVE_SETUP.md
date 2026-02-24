# Google Drive Integration Setup

This guide explains how to configure AuroraHub to automatically upload invoice PDFs to Google Drive. Invoices are organized in the following folder structure:

```
Root Folder (you configure)
└── Dealer Name/
    └── Year (e.g. 2025)/
        └── Month (e.g. 01)/
            └── Invoice_#ARR-001_2025-01-15.pdf
```

## Two Methods: OAuth vs Service Account

| Method | Use when |
|--------|----------|
| **OAuth 2.0** | Service Account key creation is **disabled** by your organization (e.g. work email). **Recommended for most users.** |
| **Service Account** | You can create keys and prefer automated, key-based auth. |

---

## Method A: OAuth 2.0 (No Service Account Key Required)

Use this when you see "Service account key creation is disabled" in GCP.

### Step A1: Create a Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Click **Select a project** → **New Project**
3. Name it (e.g. "AuroraHub") and click **Create**

### Step A2: Enable Google Drive API

1. Go to **APIs & Services** → **Library**
2. Search for **Google Drive API** and click **Enable**

### Step A3: Create OAuth 2.0 Credentials

1. Go to **APIs & Services** → **Credentials**
2. Click **Create Credentials** → **OAuth client ID**
3. If prompted, configure the OAuth consent screen:
   - User Type: **External** (or Internal for Workspace)
   - App name: AuroraHub
   - Add your email as test user (if External)
4. Application type: **Web application**
5. Name: AuroraHub Drive
6. **Authorized redirect URIs**: Add your callback URL  
   - Production: `https://yourdomain.com/api/drive-oauth/callback`  
   - Local: `http://localhost:3000/api/drive-oauth/callback`
7. Click **Create** and note the **Client ID** and **Client Secret**

### Step A4: Configure AuroraHub

1. Log in as **Aurora Manager**
2. Go to **System Management** → **API Management**
3. Under Google Drive:
   - Enable the integration
   - **OAuth Client ID**: Paste your Client ID
   - **OAuth Client Secret**: Paste your Client Secret
   - **Root Folder ID**: Create a folder in your Drive (e.g. "Aurora Invoices"), copy its ID from the URL
4. Click **Save Google Drive Settings**
5. Click **Connect to Google** – sign in with your Google account and authorize
6. You should see "✓ Connected"

---

## Method B: Service Account (Requires Key File)

### Step B1: Create a Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Click **Select a project** → **New Project**
3. Name it (e.g. "AuroraHub") and click **Create**

### Step B2: Enable Google Drive API

1. In the project, go to **APIs & Services** → **Library**
2. Search for **Google Drive API**
3. Open it and click **Enable**

### Step B3: Create a Service Account

1. Go to **APIs & Services** → **Credentials**
2. Click **Create Credentials** → **Service Account**
3. Enter a name (e.g. "AuroraHub Drive Upload") and click **Create and Continue**
4. Skip optional steps (or add description) and click **Done**
5. Click on the newly created service account
6. Go to the **Keys** tab
7. Click **Add Key** → **Create new key**
8. Select **JSON** and click **Create**  
   The key file will download automatically. **Keep it secure!**

## Step 4: Create a Shared Drive (Required)

**Important:** Service Accounts do not have storage quota. You must use a **Shared Drive** (Ekip Sürücüsü), not a regular "My Drive" folder.

1. Open [Google Drive](https://drive.google.com/)
2. Click **Shared drives** in the left sidebar (or **New** → **Shared drive**)
3. Click **+ New** to create a new Shared Drive
4. Name it (e.g. "Aurora Invoices") and click **Create**
5. Inside the Shared Drive, click **Manage members**
6. Add the **Service Account email** (from the JSON key: `client_email`, e.g. `aurorahub-xxx@project-id.iam.gserviceaccount.com`)
7. Give it **Content manager** role
8. Copy the **Shared Drive ID** from the URL when viewing it  
   Example URL: `https://drive.google.com/drive/folders/1a2B3c4D5e6F7g8H9i0J`  
   The ID is: `1a2B3c4D5e6F7g8H9i0J`

Alternatively, you can create a subfolder inside the Shared Drive and use that folder ID. The folder must be inside a Shared Drive.

### Step B5: Configure AuroraHub (Service Account)

1. Log in to AuroraHub as an **Aurora Manager**
2. Go to **Dashboard** → **System Management** → **API Management**
3. Find the **Google Drive** section
4. Enable the integration (toggle on)
5. Under Service Account, fill in:

   | Field | Value |
   |-------|-------|
   | **Service Account Email** | The `client_email` from the JSON key file |
   | **Service Account Private Key** | The entire `private_key` value from the JSON (including `-----BEGIN PRIVATE KEY-----` and `-----END PRIVATE KEY-----`) |
   | **Root Folder ID** | The Shared Drive ID (or a folder inside it) from Step B4 |

6. Click **Save Google Drive Settings**

## Uploading an Invoice

1. Go to **Dashboard** → **Admin** → **Invoices**
2. Click **Preview** on an invoice
3. In the preview modal, click the **Drive** button
4. The PDF will be uploaded to: `Root Folder / Dealer Name / Year / Month`

## Troubleshooting

### "Google Drive credentials not configured"
- Ensure Service Account Email and Private Key are filled in
- Check that the private key includes the full `-----BEGIN PRIVATE KEY-----` and `-----END PRIVATE KEY-----` lines
- Newlines in the key must be preserved (paste the key as-is from the JSON)

### "Default Folder ID is required"
- Set the Root Folder ID in API Management (must be a Shared Drive or folder inside one)

### "Service account key creation is disabled"
- Use **OAuth 2.0** instead (Method A above). No Service Account key needed.

### "Service Accounts do not have storage quota"
- **Use a Shared Drive**, not a regular My Drive folder. Create a Shared Drive, add the service account as Content manager, use the Shared Drive ID as Root Folder ID.

### "Drive upload failed: 403" or "Insufficient Permission"
- Add the service account to the Shared Drive as Content manager
- Ensure the Google Drive API is enabled in the GCP project

### "Drive upload failed: 404"
- The Root Folder ID may be wrong
- Verify the folder exists and is shared with the service account

## Security Notes

- The Service Account Private Key is stored in the database (`system_settings`). Limit access to Aurora Manager role.
- Never commit the JSON key file or private key to version control.
- Rotate the key periodically in GCP and update AuroraHub with the new credentials.
