# MCP Integration Guide

> **Purpose:** Document Model Context Protocol (MCP) servers that can enhance development and operations of the Northstar Timesheet application.
>
> **Status:** 📋 Planning
>
> **Last Updated:** January 8, 2026

---

## 🔌 What is MCP?

The **Model Context Protocol (MCP)** is an open standard that connects AI assistants to external tools and data sources. MCP servers provide structured access to APIs, databases, and services, allowing AI agents to perform actions on your behalf.

**Benefits for Development:**

- AI can directly interact with git, databases, cloud services
- Reduces context-switching between tools
- Enables automated workflows
- Provides real-time data access

---

## 📊 Current MCP Configuration

| MCP Server    | Status    | Description                               |
| ------------- | --------- | ----------------------------------------- |
| **GitKraken** | ✅ Active | Git operations, GitHub/GitLab integration |

---

## 🚀 Recommended MCP Servers

### Priority 1: High Value for This App

#### 1. Microsoft Graph MCP ⭐⭐⭐

**Relevance:** Azure AD auth, SharePoint storage, Teams bot, Outlook email

**Capabilities:**

- Query Azure AD users and groups (user sync)
- Upload/download files from SharePoint (attachment storage)
- Send Microsoft Teams messages and cards (notifications)
- Send Outlook emails (approval notifications)
- Read/write calendar events (holiday management)

**Requirements Addressed:**

- REQ-010: SharePoint attachment sync
- REQ-011: Email notifications
- REQ-012: Teams bot integration
- REQ-015: Azure AD user sync

**Installation:**

```bash
# Install the MCP server
npm install -g @anthropic/mcp-server-msgraph

# Or use npx
npx @anthropic/mcp-server-msgraph
```

**Configuration:**

```json
{
  "mcpServers": {
    "msgraph": {
      "command": "npx",
      "args": ["@anthropic/mcp-server-msgraph"],
      "env": {
        "AZURE_CLIENT_ID": "your-client-id",
        "AZURE_CLIENT_SECRET": "your-client-secret",
        "AZURE_TENANT_ID": "your-tenant-id"
      }
    }
  }
}
```

**Use Cases:**

```
"List all users in Azure AD"
"Upload this file to SharePoint document library"
"Send a Teams message to the HR channel"
"Create a calendar event for Christmas holiday"
```

---

#### 2. PostgreSQL MCP ⭐⭐⭐

**Relevance:** Direct database access for debugging, reporting, data operations

**Capabilities:**

- Execute SELECT queries
- Run INSERT/UPDATE/DELETE operations
- View table schemas
- Export query results

**Installation:**

```bash
npm install -g @anthropic/mcp-server-postgres
```

**Configuration:**

```json
{
  "mcpServers": {
    "postgres": {
      "command": "npx",
      "args": ["@anthropic/mcp-server-postgres"],
      "env": {
        "DATABASE_URL": "postgresql://timesheet:password@localhost:5432/timesheet"
      }
    }
  }
}
```

**Use Cases:**

```
"Show me all timesheets submitted this week"
"How many users have the TRAINEE role?"
"Find timesheets with Field Hours but no attachments"
"Update user X's role to SUPPORT"
```

**Security Note:**
⚠️ Consider using read-only credentials for safety:

```sql
CREATE USER mcp_readonly WITH PASSWORD 'secure_password';
GRANT SELECT ON ALL TABLES IN SCHEMA public TO mcp_readonly;
```

---

#### 3. Twilio MCP ⭐⭐

**Relevance:** SMS notifications for timesheet reminders and approvals

**Capabilities:**

- Send SMS messages
- Check message delivery status
- Manage phone number verification
- View messaging logs

**Requirements Addressed:**

- REQ-011: SMS notifications

**Installation:**

```bash
npm install -g @anthropic/mcp-server-twilio
```

**Configuration:**

```json
{
  "mcpServers": {
    "twilio": {
      "command": "npx",
      "args": ["@anthropic/mcp-server-twilio"],
      "env": {
        "TWILIO_ACCOUNT_SID": "your-account-sid",
        "TWILIO_AUTH_TOKEN": "your-auth-token",
        "TWILIO_PHONE_NUMBER": "+1234567890"
      }
    }
  }
}
```

**Use Cases:**

```
"Send an SMS to +1555123456 saying 'Your timesheet was approved'"
"Check if the message to John was delivered"
"List all SMS sent today"
```

---

### Priority 2: Helpful for Operations

#### 4. Docker MCP ⭐⭐

**Relevance:** Container management for development and deployment

**Capabilities:**

- List running containers
- View container logs
- Restart/stop containers
- Check container health
- Execute commands in containers

**Installation:**

```bash
npm install -g @anthropic/mcp-server-docker
```

**Configuration:**

```json
{
  "mcpServers": {
    "docker": {
      "command": "npx",
      "args": ["@anthropic/mcp-server-docker"]
    }
  }
}
```

**Use Cases:**

```
"Restart the timesheet-web container"
"Show me the last 50 lines of logs from nginx"
"What containers are running?"
"Execute flask db upgrade in the web container"
```

---

#### 5. Sentry MCP ⭐

**Relevance:** Error tracking and application monitoring

**Capabilities:**

- List recent errors
- View error details and stack traces
- Query error frequency
- Manage error assignments

**Installation:**

```bash
npm install -g @anthropic/mcp-server-sentry
```

**Configuration:**

```json
{
  "mcpServers": {
    "sentry": {
      "command": "npx",
      "args": ["@anthropic/mcp-server-sentry"],
      "env": {
        "SENTRY_AUTH_TOKEN": "your-auth-token",
        "SENTRY_ORG": "your-org",
        "SENTRY_PROJECT": "timesheet"
      }
    }
  }
}
```

**Use Cases:**

```
"What errors occurred in production today?"
"Show me the stack trace for error #12345"
"How often is the database timeout error happening?"
```

---

### Priority 3: Future Considerations

#### 6. Slack MCP

**Note:** Currently using Microsoft Teams for company communication. Only relevant if Slack is adopted.

#### 7. AWS/Azure MCP

**Relevance:** Cloud infrastructure management (when deployed to cloud)

**Capabilities:**

- Manage Azure resources
- Deploy to App Service
- Configure networking
- Manage secrets in Key Vault

---

## 🔧 MCP Configuration File Locations

### Claude Desktop App

```
~/Library/Application Support/Claude/claude_desktop_config.json
```

### VS Code / Cursor

- Check extension settings for MCP configuration
- May use `.vscode/settings.json` or global settings

### Gemini Code Assist

```
~/.gemini/config.json
```

---

## 📋 Implementation Checklist

### Adding a New MCP Server

1. **Install Prerequisites**

   ```bash
   # Ensure Node.js is installed
   node --version

   # Install the MCP server globally
   npm install -g @anthropic/mcp-server-<name>
   ```

2. **Configure Credentials**

   - Store API keys securely
   - Use environment variables, not hardcoded values
   - Consider using a secrets manager

3. **Update MCP Config**

   - Add server entry to your MCP configuration file
   - Restart your AI assistant to load new servers

4. **Test Connection**

   - Ask the AI to list available tools from the new server
   - Try a simple read-only operation first

5. **Document in Team**
   - Update this file with any project-specific configuration
   - Share credentials securely with team members

---

## 🔒 Security Best Practices

1. **Principle of Least Privilege**

   - Use read-only credentials when possible
   - Limit database access to specific tables
   - Restrict API scopes to minimum required

2. **Credential Management**

   - Never commit credentials to git
   - Use environment variables or secrets managers
   - Rotate credentials regularly

3. **Audit Logging**

   - Enable audit logs for database access
   - Monitor API usage in cloud dashboards
   - Review MCP activity periodically

4. **Network Security**
   - Use TLS for all connections
   - Consider IP allowlisting for production databases
   - Use private endpoints in cloud environments

---

## 📚 Resources

- [MCP Specification](https://modelcontextprotocol.io/)
- [Anthropic MCP Servers](https://github.com/anthropics/mcp-servers)
- [Microsoft Graph API Documentation](https://docs.microsoft.com/graph/)
- [Twilio API Documentation](https://www.twilio.com/docs)
- [PostgreSQL Documentation](https://www.postgresql.org/docs/)

---

_Document updated January 8, 2026_
