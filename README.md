<p align="center">
  <img src="https://www.teamleader.eu/hs-fs/hubfs/Logos/logo-teamleader-focus.png" alt="Teamleader Focus" width="300">
</p>

<h1 align="center">Teamleader MCP Server</h1>

<p align="center">
  <strong>Control Teamleader Focus with natural language through the Model Context Protocol</strong>
</p>

<p align="center">
  <a href="#features">Features</a> •
  <a href="#quick-start">Quick Start</a> •
  <a href="#installation">Installation</a> •
  <a href="#tools">Tools</a> •
  <a href="#examples">Examples</a> •
  <a href="#contributing">Contributing</a>
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/teamleader-mcp"><img src="https://img.shields.io/npm/v/teamleader-mcp" alt="npm version"></a>
  <img src="https://img.shields.io/badge/tools-42-blue" alt="42 Tools">
  <img src="https://img.shields.io/badge/license-MIT-green" alt="MIT License">
  <img src="https://img.shields.io/badge/MCP-compatible-purple" alt="MCP Compatible">
  <img src="https://img.shields.io/badge/node-%3E%3D18-brightgreen" alt="Node >= 18">
</p>

---

## What is this?

A [Model Context Protocol (MCP)](https://modelcontextprotocol.io/) server that connects AI assistants like Claude to [Teamleader Focus](https://www.teamleader.eu/) - the all-in-one CRM, invoicing, and project management platform.

**Instead of clicking through menus, just ask:**

```
"Find all open deals for Acme Corporation"
"Create an invoice for 20 hours of consulting at €125/hour"
"Schedule a meeting with Sarah from TechStart next Tuesday at 2pm"
"Log 3 hours to the website project with description: frontend development"
```

---

## Screenshots

<!-- TODO: Add screenshots before public launch -->

<p align="center">
  <i>🖼️ Screenshots coming soon</i>
</p>

<details>
<summary>Screenshot placeholders</summary>

| Description | Image |
|-------------|-------|
| Claude Desktop with deal lookup | `screenshots/deal-lookup.png` |
| Invoice creation conversation | `screenshots/invoice-creation.png` |
| Multi-step workflow example | `screenshots/workflow.png` |
| Claude Desktop config | `screenshots/config.png` |

</details>

---

## Features

### 🏢 CRM
- **Companies** - List, search, create, and update companies
- **Contacts** - Full contact management with company linking
- **Deals** - Pipeline management, move phases, win/lose tracking

### 💰 Finance
- **Invoices** - Draft, send, book, register payments
- **Quotations** - Create, send, accept, download PDFs
- **Products** - Product catalog management

### ⏱️ Operations
- **Time Tracking** - Log hours, manage entries, billable tracking
- **Calendar Events** - Create and manage meetings linked to contacts/deals
- **Email Tracking** - Log emails to entities

### 🔐 Security
- OAuth 2.0 with automatic token refresh
- Secure credential storage
- Rate limiting respect

---

## Quick Start

### 1. Authenticate with Teamleader

```bash
npx teamleader-mcp auth
```

This opens a browser for OAuth login. Your credentials are saved automatically.

### 2. Configure Claude Desktop

Add to your Claude Desktop config (`~/Library/Application Support/Claude/claude_desktop_config.json` on macOS):

```json
{
  "mcpServers": {
    "teamleader": {
      "command": "npx",
      "args": ["-y", "teamleader-mcp"]
    }
  }
}
```

### 3. Start Using!

Restart Claude Desktop and ask: *"What Teamleader tools do you have access to?"*

---

## Installation

### Prerequisites
- Node.js 18 or higher
- A Teamleader Focus account
- OAuth 2.0 credentials from [Teamleader Marketplace](https://marketplace.focus.teamleader.eu/build)

### Via npx (Recommended)
No installation needed - runs directly:
```bash
npx teamleader-mcp auth    # One-time OAuth setup
npx teamleader-mcp          # Start the MCP server
```

### Global Install
```bash
npm install -g teamleader-mcp
teamleader-mcp auth
```

### From Source
```bash
git clone https://github.com/Weichie-com/teamleader-mcp.git
cd teamleader-mcp
npm install
npm run build
```

---

## OAuth Setup

### 1. Register Your Integration

1. Go to [Teamleader Marketplace](https://marketplace.focus.teamleader.eu/build)
2. Create a new integration
3. Note your `client_id` and `client_secret`
4. Set redirect URI: `http://localhost:3000/callback`
5. Required scopes: `contacts`, `companies`, `deals`, `invoices`, `products`, `timetracking`, `events`, `users`

### 2. Generate Tokens

The easiest way:
```bash
node scripts/generate-token.js
```

Or manually via OAuth authorization code flow - see [OAUTH_CLAUDE_SETUP.md](OAUTH_CLAUDE_SETUP.md).

### 3. Configure Environment

```bash
cp .env.example .env
```

Edit `.env`:
```bash
TEAMLEADER_ACCESS_TOKEN=your_access_token
TEAMLEADER_CLIENT_ID=your_client_id
TEAMLEADER_CLIENT_SECRET=your_client_secret
TEAMLEADER_REFRESH_TOKEN=your_refresh_token
```

---

## Tools

This server provides **43 tools** across all major Teamleader Focus features:

### Companies (4 tools)
| Tool | Description |
|------|-------------|
| `teamleader_companies_list` | List/search companies |
| `teamleader_company_info` | Get company details |
| `teamleader_company_create` | Create a company |
| `teamleader_company_update` | Update a company |

### Contacts (2 tools)
| Tool | Description |
|------|-------------|
| `teamleader_contacts_list` | List/search contacts |
| `teamleader_contact_info` | Get contact details |

### Deals (7 tools)
| Tool | Description |
|------|-------------|
| `teamleader_deals_list` | List deals with filters |
| `teamleader_deal_info` | Get deal details |
| `teamleader_deal_create` | Create a deal |
| `teamleader_deal_update` | Update a deal |
| `teamleader_deal_move` | Move to different phase |
| `teamleader_deal_win` | Mark as won |
| `teamleader_deal_lose` | Mark as lost |

### Invoices (7 tools)
| Tool | Description |
|------|-------------|
| `teamleader_invoices_list` | List invoices |
| `teamleader_invoice_info` | Get invoice details |
| `teamleader_invoice_draft` | Create draft invoice |
| `teamleader_invoice_update` | Update invoice |
| `teamleader_invoice_send` | Send via email |
| `teamleader_invoice_book` | Book/finalize |
| `teamleader_invoice_register_payment` | Register payment |
| `teamleader_invoice_delete` | Delete invoice |

### Quotations (7 tools)
| Tool | Description |
|------|-------------|
| `teamleader_quotations_list` | List quotations |
| `teamleader_quotation_info` | Get quotation details |
| `teamleader_quotation_create` | Create quotation |
| `teamleader_quotation_update` | Update quotation |
| `teamleader_quotation_send` | Send via email |
| `teamleader_quotation_accept` | Mark as accepted |
| `teamleader_quotation_delete` | Delete quotation |
| `teamleader_quotation_download` | Get PDF link |

### Products (4 tools)
| Tool | Description |
|------|-------------|
| `teamleader_products_list` | List products |
| `teamleader_product_info` | Get product details |
| `teamleader_product_create` | Create product |
| `teamleader_product_update` | Update product |

### Time Tracking (5 tools)
| Tool | Description |
|------|-------------|
| `teamleader_timetracking_list` | List time entries |
| `teamleader_timetracking_info` | Get entry details |
| `teamleader_timetracking_add` | Add time entry |
| `teamleader_timetracking_update` | Update entry |
| `teamleader_timetracking_delete` | Delete entry |

### Calendar Events (3 tools)
| Tool | Description |
|------|-------------|
| `teamleader_events_list` | List events |
| `teamleader_event_info` | Get event details |
| `teamleader_event_create` | Create event |

### Email Tracking (2 tools)
| Tool | Description |
|------|-------------|
| `teamleader_emails_list` | List tracked emails |
| `teamleader_email_track` | Log an email |

---

### Generic API call (any endpoint)

`teamleader_api_call` calls any Teamleader Focus method that has no dedicated tool, e.g. `dealPhases.list`, `users.list`, `tickets.list`, `projects-v2.projects.list`, `contacts.update`. Pass the method name from the [API reference](https://developer.focus.teamleader.eu/) and the JSON body as `params`:

```bash
mcporter call teamleader.teamleader_api_call method=dealPhases.list
mcporter call teamleader.teamleader_api_call method=tickets.list params='{"page":{"size":50}}'
```

It reuses the server's OAuth token and automatic refresh. Set `TEAMLEADER_RAW_READONLY=true` to restrict it to read-only methods (`*.list`, `*.info`, `*.download`, `*.me`, `*.search`).

## Examples

### Natural Language → Actions

**"Find all open deals worth more than €10,000"**
```
→ teamleader_deals_list(status: ["open"])
→ Filters results by value
```

**"Create an invoice for Acme Corp: 20 hours consulting at €125/hour, 30 days payment term"**
```
→ teamleader_companies_list(term: "Acme Corp")
→ teamleader_invoice_draft(customer_id: "...", grouped_lines: [...])
```

**"Schedule a meeting with John from DataFlow next Tuesday at 2pm"**
```
→ teamleader_contacts_list(term: "John DataFlow")
→ teamleader_event_create(title: "Meeting", starts_at: "...", contact_ids: [...])
```

### Direct Tool Calls

```bash
# List open deals
mcporter call teamleader.teamleader_deals_list status='["open"]'

# Get company info
mcporter call teamleader.teamleader_company_info id="uuid-here"

# Create a time entry
mcporter call teamleader.teamleader_timetracking_add \
  started_at="2026-01-31T09:00:00+01:00" \
  ended_at="2026-01-31T12:00:00+01:00" \
  description="Development work"
```

---

## Configuration Options

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `TEAMLEADER_ACCESS_TOKEN` | Yes | OAuth access token |
| `TEAMLEADER_CLIENT_ID` | No* | OAuth client ID |
| `TEAMLEADER_CLIENT_SECRET` | No* | OAuth client secret |
| `TEAMLEADER_REFRESH_TOKEN` | No* | OAuth refresh token |
| `TEAMLEADER_TOKEN_STORAGE` | No | Custom token storage path |

*Required for automatic token refresh (recommended)

### Token Refresh Modes

**Static Mode:** Only `ACCESS_TOKEN` set. Token expires after 1 hour. Manual refresh needed.

**Auto Refresh Mode (Recommended):** All four OAuth variables set. Tokens refresh automatically 5 minutes before expiry.

---

## Troubleshooting

<details>
<summary><strong>Server hangs or times out</strong></summary>

Make sure your config includes the `args` array:

```json
{
  "command": "node",
  "args": ["/path/to/teamleader-mcp/dist/index.js"]  // ← Required!
}
```
</details>

<details>
<summary><strong>"Unknown tool" error</strong></summary>

Tool names are prefixed with `teamleader_`. Use `teamleader_deal_info`, not `get-deal`.

Run `mcporter list teamleader` to see all tools.
</details>

<details>
<summary><strong>401 Unauthorized</strong></summary>

Access tokens expire after 1 hour. Set up automatic refresh with all OAuth variables, or manually refresh your token.
</details>

<details>
<summary><strong>Rate limiting errors</strong></summary>

Teamleader allows 200 requests/minute. The server respects rate limit headers. Wait and retry, or reduce request frequency.
</details>

---

## Development

```bash
# Build
npm run build

# Watch mode
npm run dev

# Test
npm test              # Watch mode
npm run test:run      # Single run

# Lint
npm run lint
```

---

## Contributing

We welcome contributions! Here's how to help:

### Bug Reports & Feature Requests
- Open an issue with a clear description
- Include steps to reproduce for bugs
- For features, explain the use case

### Pull Requests
1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Make your changes
4. Run tests: `npm test`
5. Commit: `git commit -m 'Add amazing feature'`
6. Push: `git push origin feature/amazing-feature`
7. Open a Pull Request

### Code Style
- TypeScript with strict mode
- Prettier for formatting
- ESLint for linting
- Descriptive commit messages

### Adding New Tools
1. Add the tool definition in `src/tools/`
2. Implement the handler
3. Add tests in `tests/`
4. Update this README

---

## Roadmap

- [x] npm package publication
- [ ] Project management tools (milestones, tasks)
- [ ] Webhook support for real-time updates
- [ ] Batch operations
- [ ] More filter options
- [ ] Credit notes support

See [ROADMAP.md](ROADMAP.md) for details.

---

## Related Resources

- [Teamleader Focus API Documentation](https://developer.teamleader.eu/)
- [Model Context Protocol](https://modelcontextprotocol.io/)
- [Teamleader Marketplace](https://marketplace.focus.teamleader.eu/)
- [Claude Desktop](https://claude.ai/download)

---

## License

MIT License - see [LICENSE](LICENSE) file.

---

## Acknowledgments

Built with ❤️ using the [Model Context Protocol](https://modelcontextprotocol.io/) by Anthropic.

---

<p align="center">
  <sub>Made by <a href="https://weichie.com">Weichie</a> • Star ⭐ if you find this useful!</sub>
</p>
