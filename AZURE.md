# Azure AD Configuration Guide

This guide walks through setting up Microsoft 365 / Azure AD authentication for the Northstar Timesheet application.

## Prerequisites

- Access to your organization's Azure Portal with permissions to create App Registrations
- The Timesheet application running (locally or in Docker)

---

## Step 1: Create App Registration

1. Go to [Azure Portal](https://portal.azure.com)
2. Navigate to **Azure Active Directory** → **App registrations**
3. Click **New registration**

### Registration Settings

| Field                       | Value                                                            |
| --------------------------- | ---------------------------------------------------------------- |
| **Name**                    | `Northstar Timesheet`                                            |
| **Supported account types** | `Accounts in this organizational directory only` (single tenant) |
| **Redirect URI - Platform** | `Web`                                                            |
| **Redirect URI - URL**      | See table below                                                  |

### Redirect URIs by Environment

| Environment        | Redirect URI                            |
| ------------------ | --------------------------------------- |
| Docker (localhost) | `http://localhost/auth/callback`        |
| Local Flask dev    | `http://localhost:5000/auth/callback`   |
| Production         | `https://your-domain.com/auth/callback` |

4. Click **Register**

---

## Step 2: Collect Credentials

After registration, you'll be on the App's **Overview** page. Copy these values:

| Azure Portal Field          | Environment Variable |
| --------------------------- | -------------------- |
| **Application (client) ID** | `AZURE_CLIENT_ID`    |
| **Directory (tenant) ID**   | `AZURE_TENANT_ID`    |

---

## Step 3: Create Client Secret

1. Go to **Certificates & secrets** (left sidebar)
2. Click **New client secret**
3. Configure:
   - **Description**: `Timesheet App Secret`
   - **Expires**: Choose based on your security policy (recommended: 12-24 months)
4. Click **Add**
5. **IMPORTANT**: Copy the **Value** immediately (it won't be shown again)

| Azure Portal Field | Environment Variable  |
| ------------------ | --------------------- |
| **Secret Value**   | `AZURE_CLIENT_SECRET` |

---

## Step 4: Configure API Permissions

1. Go to **API permissions** (left sidebar)
2. Verify `User.Read` is present (added by default)
3. If not, click **Add a permission** → **Microsoft Graph** → **Delegated permissions**
4. Search for and add: `User.Read`
5. Click **Grant admin consent for [Your Organization]** (if you have admin rights)

### Required Permissions

| API             | Permission  | Type      | Description                   |
| --------------- | ----------- | --------- | ----------------------------- |
| Microsoft Graph | `User.Read` | Delegated | Sign in and read user profile |

---

## Step 5: Update Environment Variables

### Option A: Docker (.env file in docker/ directory)

Create or edit `docker/.env`:

```bash
# Microsoft 365 / Azure AD
AZURE_CLIENT_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
AZURE_CLIENT_SECRET=your-secret-value-here
AZURE_TENANT_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
AZURE_REDIRECT_URI=http://localhost/auth/callback
```

### Option B: Local Development (.env in project root)

```bash
# Microsoft 365 / Azure AD
AZURE_CLIENT_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
AZURE_CLIENT_SECRET=your-secret-value-here
AZURE_TENANT_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
AZURE_REDIRECT_URI=http://localhost:5000/auth/callback
```

---

## Step 6: Restart the Application

### Docker

```bash
cd docker
docker-compose down
docker-compose up --build
```

### Local Development

```bash
# Stop the running Flask app (Ctrl+C)
flask run
```

---

## Step 7: Test Authentication

1. Open `http://localhost` (Docker) or `http://localhost:5000` (local)
2. You should be redirected to Microsoft login
3. Sign in with your Microsoft 365 account
4. Grant consent for the app to read your profile
5. You should be redirected back to the Timesheet dashboard

---

## Troubleshooting

### "AADSTS50011: The redirect URI does not match"

The redirect URI in Azure doesn't match what the app is sending.

**Fix**:

1. Go to App Registration → **Authentication**
2. Add the exact redirect URI your app is using
3. Common URIs to add:
   - `http://localhost/auth/callback`
   - `http://localhost:5000/auth/callback`

### "AADSTS7000218: Request body must contain client_secret"

The client secret is missing or incorrect.

**Fix**:

1. Verify `AZURE_CLIENT_SECRET` is set in your `.env` file
2. Make sure you copied the **Value**, not the **Secret ID**
3. If the secret expired, create a new one

### "AADSTS65001: User or admin has not consented"

The user needs to consent to the app permissions.

**Fix**:

1. Go to App Registration → **API permissions**
2. Click **Grant admin consent for [Organization]**
3. Or: Individual users will be prompted to consent on first login

### Still seeing "DEV MODE: Bypassing Azure AD authentication"

The app is not detecting valid Azure credentials.

**Fix**:

1. Verify all three env vars are set: `AZURE_CLIENT_ID`, `AZURE_CLIENT_SECRET`, `AZURE_TENANT_ID`
2. Make sure values don't contain "your-azure" placeholder text
3. Restart the application after changing `.env`

---

## Security Notes

- **Never commit `.env` files** to version control (they're in `.gitignore`)
- **Rotate client secrets** periodically (before expiration)
- **Use HTTPS in production** - update redirect URI accordingly
- **Principle of least privilege** - only request `User.Read` scope

---

## Optional: Add More Redirect URIs

If you need multiple environments, you can add additional redirect URIs:

1. Go to App Registration → **Authentication**
2. Under **Web** → **Redirect URIs**, click **Add URI**
3. Add all environments you need:
   - `http://localhost/auth/callback`
   - `http://localhost:5000/auth/callback`
   - `https://staging.example.com/auth/callback`
   - `https://timesheet.example.com/auth/callback`

---

## Reference: Environment Variables

| Variable              | Description                                   | Example                                |
| --------------------- | --------------------------------------------- | -------------------------------------- |
| `AZURE_CLIENT_ID`     | Application (client) ID from App Registration | `12345678-1234-1234-1234-123456789abc` |
| `AZURE_CLIENT_SECRET` | Client secret value                           | `abc123~xxxxxxxxxxxxxxxxxxxxxx`        |
| `AZURE_TENANT_ID`     | Directory (tenant) ID                         | `87654321-4321-4321-4321-cba987654321` |
| `AZURE_REDIRECT_URI`  | OAuth callback URL                            | `http://localhost/auth/callback`       |
