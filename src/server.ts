/**
 * Teamleader Focus MCP Server
 * 
 * Model Context Protocol server providing tools to interact with
 * Teamleader Focus API for CRM, invoicing, time tracking and more.
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ErrorCode,
  McpError,
} from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';

import { TeamleaderClient, TeamleaderApiError } from './client/teamleader.js';
import { TokenManager } from './auth/token-manager.js';
import * as calendar from './tools/calendar.js';
import * as contacts from './tools/contacts.js';
import * as companies from './tools/companies.js';
import * as deals from './tools/deals.js';
import * as invoices from './tools/invoices.js';
import * as quotations from './tools/quotations.js';
import * as products from './tools/products.js';
import * as timetracking from './tools/timetracking.js';
import * as email from './tools/email.js';
import * as raw from './tools/raw.js';

// Tool definitions
const TOOLS = [
  // ============================================================================
  // CALENDAR TOOLS
  // ============================================================================
  {
    name: 'teamleader_events_list',
    description: 'List calendar events from Teamleader Focus. Can filter by date range, contact, company, or deal.',
    inputSchema: {
      type: 'object',
      properties: {
        from: { type: 'string', description: 'Start datetime (full ISO 8601 with timezone, e.g., 2026-02-01T00:00:00+01:00)' },
        to: { type: 'string', description: 'End datetime (full ISO 8601 with timezone, e.g., 2026-02-28T23:59:59+01:00)' },
        contact_id: { type: 'string', description: 'Filter by linked contact UUID' },
        company_id: { type: 'string', description: 'Filter by linked company UUID' },
        deal_id: { type: 'string', description: 'Filter by linked deal UUID' },
        user_id: { type: 'string', description: 'Filter by attendee user UUID' },
      },
    },
  },
  {
    name: 'teamleader_event_info',
    description: 'Get details of a specific calendar event by ID.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Event UUID' },
      },
      required: ['id'],
    },
  },
  {
    name: 'teamleader_event_create',
    description: 'Create a new calendar event in Teamleader Focus.',
    inputSchema: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Event title' },
        starts_at: { type: 'string', description: 'Start datetime (ISO 8601)' },
        ends_at: { type: 'string', description: 'End datetime (ISO 8601)' },
        activity_type_id: { type: 'string', description: 'Activity type ID (required for some Teamleader setups)' },
        description: { type: 'string', description: 'Event description' },
        location: { type: 'string', description: 'Event location' },
        contact_ids: { type: 'array', items: { type: 'string' }, description: 'Contact UUIDs to link' },
        company_ids: { type: 'array', items: { type: 'string' }, description: 'Company UUIDs to link' },
        deal_ids: { type: 'array', items: { type: 'string' }, description: 'Deal UUIDs to link' },
        attendee_ids: { type: 'array', items: { type: 'string' }, description: 'User UUIDs of attendees' },
      },
      required: ['title', 'starts_at', 'ends_at'],
    },
  },
  
  // ============================================================================
  // CONTACTS TOOLS
  // ============================================================================
  {
    name: 'teamleader_contacts_list',
    description: 'List contacts from Teamleader Focus. Can filter by name, email, company, or tags.',
    inputSchema: {
      type: 'object',
      properties: {
        term: { type: 'string', description: 'Search term (name, email, phone)' },
        company_id: { type: 'string', description: 'Filter by linked company UUID' },
        tags: { type: 'array', items: { type: 'string' }, description: 'Filter by tags' },
        status: { type: 'string', enum: ['active', 'deactivated'], description: 'Filter by status' },
      },
    },
  },
  {
    name: 'teamleader_contact_info',
    description: 'Get details of a specific contact by ID, including linked companies.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Contact UUID' },
      },
      required: ['id'],
    },
  },
  
  // ============================================================================
  // COMPANIES TOOLS
  // ============================================================================
  {
    name: 'teamleader_companies_list',
    description: 'List companies from Teamleader Focus. Can filter by name, VAT number, or tags.',
    inputSchema: {
      type: 'object',
      properties: {
        term: { type: 'string', description: 'Search term (name, VAT, email, phone)' },
        vat_number: { type: 'string', description: 'Filter by VAT number' },
        tags: { type: 'array', items: { type: 'string' }, description: 'Filter by tags' },
        status: { type: 'string', enum: ['active', 'deactivated'], description: 'Filter by status' },
        updated_since: { type: 'string', description: 'Filter by last update (ISO 8601)' },
      },
    },
  },
  {
    name: 'teamleader_company_info',
    description: 'Get details of a specific company by ID.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Company UUID' },
      },
      required: ['id'],
    },
  },
  {
    name: 'teamleader_company_create',
    description: 'Create a new company in Teamleader Focus.',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Company name (required)' },
        vat_number: { type: 'string', description: 'VAT number' },
        emails: { type: 'array', items: { type: 'object' }, description: 'Email addresses' },
        telephones: { type: 'array', items: { type: 'object' }, description: 'Phone numbers' },
        website: { type: 'string', description: 'Website URL' },
        language: { type: 'string', description: 'Language code (e.g., nl, en)' },
        tags: { type: 'array', items: { type: 'string' }, description: 'Tags to add' },
      },
      required: ['name'],
    },
  },
  {
    name: 'teamleader_company_update',
    description: 'Update an existing company in Teamleader Focus.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Company UUID (required)' },
        name: { type: 'string', description: 'Company name' },
        vat_number: { type: 'string', description: 'VAT number' },
        tags: { type: 'array', items: { type: 'string' }, description: 'Tags (overwrites existing)' },
      },
      required: ['id'],
    },
  },
  
  // ============================================================================
  // DEALS TOOLS
  // ============================================================================
  {
    name: 'teamleader_deals_list',
    description: 'List deals/opportunities from Teamleader Focus. Can filter by status, customer, or phase.',
    inputSchema: {
      type: 'object',
      properties: {
        term: { type: 'string', description: 'Search term (title, reference, customer)' },
        status: { type: 'array', items: { type: 'string', enum: ['open', 'won', 'lost'] }, description: 'Filter by status' },
        customer_type: { type: 'string', enum: ['contact', 'company'], description: 'Customer type' },
        customer_id: { type: 'string', description: 'Customer UUID' },
        phase_id: { type: 'string', description: 'Filter by deal phase UUID' },
        responsible_user_id: { type: 'string', description: 'Filter by responsible user UUID' },
      },
    },
  },
  {
    name: 'teamleader_deal_info',
    description: 'Get details of a specific deal by ID.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Deal UUID' },
      },
      required: ['id'],
    },
  },
  {
    name: 'teamleader_deal_create',
    description: 'Create a new deal/opportunity in Teamleader Focus.',
    inputSchema: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Deal title (required)' },
        customer_type: { type: 'string', enum: ['contact', 'company'], description: 'Customer type (required)' },
        customer_id: { type: 'string', description: 'Customer UUID (required)' },
        summary: { type: 'string', description: 'Deal summary' },
        estimated_value: { type: 'number', description: 'Estimated value' },
        estimated_probability: { type: 'number', description: 'Probability (0-1)' },
        estimated_closing_date: { type: 'string', description: 'Expected close date (YYYY-MM-DD)' },
        phase_id: { type: 'string', description: 'Initial deal phase UUID' },
        responsible_user_id: { type: 'string', description: 'Responsible user UUID' },
      },
      required: ['title', 'customer_type', 'customer_id'],
    },
  },
  {
    name: 'teamleader_deal_update',
    description: 'Update an existing deal in Teamleader Focus.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Deal UUID (required)' },
        title: { type: 'string', description: 'Deal title' },
        summary: { type: 'string', description: 'Deal summary' },
        estimated_value: { type: 'number', description: 'Estimated value' },
        estimated_probability: { type: 'number', description: 'Probability (0-1)' },
      },
      required: ['id'],
    },
  },
  {
    name: 'teamleader_deal_move',
    description: 'Move a deal to a different phase.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Deal UUID' },
        phase_id: { type: 'string', description: 'Target phase UUID' },
      },
      required: ['id', 'phase_id'],
    },
  },
  {
    name: 'teamleader_deal_win',
    description: 'Mark a deal as won.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Deal UUID' },
      },
      required: ['id'],
    },
  },
  {
    name: 'teamleader_deal_lose',
    description: 'Mark a deal as lost.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Deal UUID' },
        reason_id: { type: 'string', description: 'Lost reason UUID' },
        extra_info: { type: 'string', description: 'Additional explanation' },
      },
      required: ['id'],
    },
  },
  
  // ============================================================================
  // INVOICES TOOLS
  // ============================================================================
  {
    name: 'teamleader_invoices_list',
    description: 'List invoices from Teamleader Focus. Can filter by status, customer, or date. Returns max 100 per page.',
    inputSchema: {
      type: 'object',
      properties: {
        term: { type: 'string', description: 'Search term' },
        status: { type: 'array', items: { type: 'string', enum: ['draft', 'outstanding', 'matched'] }, description: 'Filter by status' },
        invoice_date_after: { type: 'string', description: 'Filter by date (YYYY-MM-DD)' },
        invoice_date_before: { type: 'string', description: 'Filter by date (YYYY-MM-DD)' },
        customer_type: { type: 'string', enum: ['contact', 'company'] },
        customer_id: { type: 'string', description: 'Customer UUID' },
        page_size: { type: 'number', description: 'Items per page (max 100)', minimum: 1, maximum: 100 },
        page_number: { type: 'number', description: 'Page number (starts at 1)', minimum: 1 },
      },
    },
  },
  {
    name: 'teamleader_invoice_info',
    description: 'Get details of a specific invoice by ID.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Invoice UUID' },
      },
      required: ['id'],
    },
  },
  {
    name: 'teamleader_invoice_draft',
    description: 'Create a new draft invoice in Teamleader Focus.',
    inputSchema: {
      type: 'object',
      properties: {
        customer_type: { type: 'string', enum: ['contact', 'company'], description: 'Customer type' },
        customer_id: { type: 'string', description: 'Customer UUID' },
        department_id: { type: 'string', description: 'Department UUID' },
        payment_term_type: { type: 'string', enum: ['cash', 'end_of_month', 'after_invoice_date'] },
        payment_term_days: { type: 'number', description: 'Days for payment term' },
        grouped_lines: { type: 'array', description: 'Invoice line items' },
        note: { type: 'string', description: 'Invoice note' },
      },
      required: ['customer_type', 'customer_id', 'department_id', 'payment_term_type', 'grouped_lines'],
    },
  },
  {
    name: 'teamleader_invoice_send',
    description: 'Send an invoice via email.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Invoice UUID' },
        subject: { type: 'string', description: 'Email subject' },
        body: { type: 'string', description: 'Email body' },
        to: { type: 'array', items: { type: 'string' }, description: 'Recipient email addresses' },
      },
      required: ['id', 'subject', 'body', 'to'],
    },
  },
  {
    name: 'teamleader_invoice_book',
    description: 'Book a draft invoice (finalize it).',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Invoice UUID' },
        on: { type: 'string', description: 'Booking date (YYYY-MM-DD)' },
      },
      required: ['id', 'on'],
    },
  },
  {
    name: 'teamleader_invoice_delete',
    description: 'Delete a draft invoice or the last booked invoice.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Invoice UUID' },
      },
      required: ['id'],
    },
  },
  {
    name: 'teamleader_invoice_register_payment',
    description: 'Register a payment for an invoice.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Invoice UUID' },
        amount: { type: 'number', description: 'Payment amount' },
        currency: { type: 'string', description: 'Currency code (e.g., EUR)' },
        paid_at: { type: 'string', description: 'Payment date (ISO 8601)' },
      },
      required: ['id', 'amount', 'paid_at'],
    },
  },
  
  // ============================================================================
  // QUOTATIONS TOOLS
  // ============================================================================
  {
    name: 'teamleader_quotations_list',
    description: 'List quotations from Teamleader Focus.',
    inputSchema: {
      type: 'object',
      properties: {
        ids: { type: 'array', items: { type: 'string' }, description: 'Filter by UUIDs' },
      },
    },
  },
  {
    name: 'teamleader_quotation_info',
    description: 'Get details of a specific quotation by ID.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Quotation UUID' },
      },
      required: ['id'],
    },
  },
  {
    name: 'teamleader_quotation_create',
    description: 'Create a new quotation in Teamleader Focus.',
    inputSchema: {
      type: 'object',
      properties: {
        deal_id: { type: 'string', description: 'Deal UUID (required)' },
        name: { type: 'string', description: 'Quotation name/title' },
        grouped_lines: { type: 'array', description: 'Quotation line items' },
        text: { type: 'string', description: 'Quotation text (Markdown)' },
        document_template_id: { type: 'string', description: 'Document template UUID for PDF layout' },
        expiry: { type: 'object', description: 'Expiry settings: {expires_after: "P30D", action_after_expiry: "lock"|"none"}' },
      },
      required: ['deal_id'],
    },
  },
  {
    name: 'teamleader_quotation_update',
    description: 'Update an existing quotation in Teamleader Focus.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Quotation UUID (required)' },
        name: { type: 'string', description: 'Quotation name/title' },
        grouped_lines: { type: 'array', description: 'Quotation line items' },
        text: { type: 'string', description: 'Quotation text (Markdown)' },
        document_template_id: { type: 'string', description: 'Document template UUID for PDF layout' },
        expiry: { type: 'object', description: 'Expiry settings' },
      },
      required: ['id'],
    },
  },
  {
    name: 'teamleader_quotation_send',
    description: 'Send a quotation via email.',
    inputSchema: {
      type: 'object',
      properties: {
        quotation_ids: { type: 'array', items: { type: 'string' }, description: 'Quotation UUIDs to send' },
        subject: { type: 'string', description: 'Email subject' },
        content: { type: 'string', description: 'Email content (use #LINK for cloudsign URL)' },
        to: { type: 'array', items: { type: 'string' }, description: 'Recipient email addresses' },
        language: { type: 'string', description: 'Language code' },
      },
      required: ['quotation_ids', 'subject', 'content', 'to', 'language'],
    },
  },
  {
    name: 'teamleader_quotation_accept',
    description: 'Mark a quotation as accepted.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Quotation UUID' },
      },
      required: ['id'],
    },
  },
  {
    name: 'teamleader_quotation_delete',
    description: 'Delete a quotation.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Quotation UUID' },
      },
      required: ['id'],
    },
  },
  {
    name: 'teamleader_quotation_download',
    description: 'Get a download link for a quotation PDF.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Quotation UUID' },
      },
      required: ['id'],
    },
  },
  
  // ============================================================================
  // PRODUCTS TOOLS
  // ============================================================================
  {
    name: 'teamleader_products_list',
    description: 'List products from Teamleader Focus.',
    inputSchema: {
      type: 'object',
      properties: {
        term: { type: 'string', description: 'Search term (name, code)' },
        updated_since: { type: 'string', description: 'Filter by last update (ISO 8601)' },
      },
    },
  },
  {
    name: 'teamleader_product_info',
    description: 'Get details of a specific product by ID.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Product UUID' },
      },
      required: ['id'],
    },
  },
  {
    name: 'teamleader_product_create',
    description: 'Create a new product in Teamleader Focus.',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Product name (required)' },
        description: { type: 'string', description: 'Product description (Markdown)' },
        code: { type: 'string', description: 'Product code/SKU' },
        selling_price: { type: 'number', description: 'Selling price' },
        purchase_price: { type: 'number', description: 'Purchase price' },
        currency: { type: 'string', description: 'Currency code (default: EUR)' },
      },
      required: ['name'],
    },
  },
  {
    name: 'teamleader_product_update',
    description: 'Update an existing product in Teamleader Focus.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Product UUID (required)' },
        name: { type: 'string', description: 'Product name' },
        description: { type: 'string', description: 'Product description' },
        code: { type: 'string', description: 'Product code/SKU' },
        selling_price: { type: 'number', description: 'Selling price' },
      },
      required: ['id'],
    },
  },
  
  // ============================================================================
  // TIME TRACKING TOOLS
  // ============================================================================
  {
    name: 'teamleader_timetracking_list',
    description: 'List time tracking entries from Teamleader Focus.',
    inputSchema: {
      type: 'object',
      properties: {
        user_id: { type: 'string', description: 'Filter by user UUID' },
        started_after: { type: 'string', description: 'Filter by start date (ISO 8601)' },
        started_before: { type: 'string', description: 'Filter by start date (ISO 8601)' },
        subject_type: { type: 'string', enum: ['milestone', 'ticket', 'nextgenTask'], description: 'Subject type' },
        subject_id: { type: 'string', description: 'Subject UUID' },
      },
    },
  },
  {
    name: 'teamleader_timetracking_info',
    description: 'Get details of a specific time tracking entry by ID.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Time tracking UUID' },
      },
      required: ['id'],
    },
  },
  {
    name: 'teamleader_timetracking_add',
    description: 'Add a new time tracking entry in Teamleader Focus.',
    inputSchema: {
      type: 'object',
      properties: {
        started_at: { type: 'string', description: 'Start datetime (ISO 8601, required)' },
        ended_at: { type: 'string', description: 'End datetime (ISO 8601, required)' },
        description: { type: 'string', description: 'Work description' },
        work_type_id: { type: 'string', description: 'Work type UUID' },
        subject_type: { type: 'string', enum: ['milestone', 'ticket', 'nextgenTask'], description: 'Link to subject type' },
        subject_id: { type: 'string', description: 'Subject UUID' },
        invoiceable: { type: 'boolean', description: 'Is this billable? (default: true)' },
      },
      required: ['started_at', 'ended_at'],
    },
  },
  {
    name: 'teamleader_timetracking_update',
    description: 'Update an existing time tracking entry.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Time tracking UUID (required)' },
        description: { type: 'string', description: 'Work description' },
        invoiceable: { type: 'boolean', description: 'Is this billable?' },
      },
      required: ['id'],
    },
  },
  {
    name: 'teamleader_timetracking_delete',
    description: 'Delete a time tracking entry.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Time tracking UUID' },
      },
      required: ['id'],
    },
  },
  
  // ============================================================================
  // EMAIL TRACKING TOOLS
  // ============================================================================
  {
    name: 'teamleader_email_track',
    description: 'Track/log an email in Teamleader Focus. Links the email to a contact, company, or deal.',
    inputSchema: {
      type: 'object',
      properties: {
        subject: { type: 'string', description: 'Email subject' },
        body: { type: 'string', description: 'Email body (HTML supported)' },
        from: { type: 'string', description: 'Sender email address' },
        to: { type: 'array', items: { type: 'string' }, description: 'Recipient email addresses' },
        subject_type: { type: 'string', enum: ['contact', 'company', 'deal', 'nextgenProject'], description: 'Entity type to link to' },
        subject_id: { type: 'string', description: 'Entity UUID to link to' },
      },
      required: ['subject', 'body', 'from', 'to', 'subject_type', 'subject_id'],
    },
  },
  {
    name: 'teamleader_emails_list',
    description: 'List tracked emails from Teamleader Focus. REQUIRED: Both subject_type and subject_id must be provided to filter by linked entity.',
    inputSchema: {
      type: 'object',
      properties: {
        subject_type: { type: 'string', enum: ['contact', 'company', 'deal', 'nextgenProject'], description: 'Filter by entity type (REQUIRED)' },
        subject_id: { type: 'string', description: 'Filter by entity UUID (REQUIRED)' },
      },
      required: ['subject_type', 'subject_id'],
    },
  },

  // ============================================================================
  // GENERIC PASSTHROUGH
  // ============================================================================
  {
    name: 'teamleader_api_call',
    description:
      'Call ANY Teamleader Focus API method directly. Use this only when no dedicated teamleader_* tool covers the need ' +
      '(e.g. dealPhases.list, users.list, departments.list, projects-v2.projects.list, tickets.list, workTypes.list, ' +
      'customFieldDefinitions.list, tasks.list, subscriptions.list, creditNotes.list, contacts.update). ' +
      'Pass the method name exactly as in the API reference (https://developer.focus.teamleader.eu) and the JSON body as params. ' +
      'List methods accept params like {"filter": {...}, "page": {"size": 100, "number": 1}, "sort": [{"field": "...", "order": "desc"}]}. ' +
      'Write methods (add, update, delete, move, ...) change real data: confirm with the user before calling them.',
    inputSchema: {
      type: 'object',
      properties: {
        method: { type: 'string', description: 'API method, e.g. "dealPhases.list", "users.me", "contacts.update"' },
        params: { type: 'object', description: 'JSON request body for the method (omit or {} if none)' },
      },
      required: ['method'],
    },
  },
];

/**
 * Token refresh callback type
 * Returns the new access token after refresh
 */
type TokenRefreshCallback = () => Promise<string>;

export function createServer(
  client: TeamleaderClient, 
  onTokenRefresh?: TokenRefreshCallback
): Server {
  const server = new Server(
    {
      name: 'teamleader-mcp',
      title: 'Teamleader Focus',
      version: '1.0.3',
      websiteUrl: 'https://github.com/Weichie-com/teamleader-mcp',
      icons: [
        {
          src: 'https://focus.teamleader.eu/favicon.ico',
          mimeType: 'image/x-icon',
        },
      ],
    },
    {
      capabilities: {
        tools: {},
      },
    }
  );

  /**
   * Execute an API call with automatic retry on 401 (token expired)
   */
  async function withRetry<T>(fn: () => Promise<T>): Promise<T> {
    try {
      return await fn();
    } catch (error) {
      // If we get a 401 and can refresh, try once more
      if (
        error instanceof TeamleaderApiError &&
        error.status === 401 &&
        onTokenRefresh
      ) {
        console.error('[Server] Got 401, attempting token refresh...');
        const newToken = await onTokenRefresh();
        client.setAccessToken(newToken);
        console.error('[Server] Token refreshed, retrying request...');
        return await fn();
      }
      throw error;
    }
  }

  // List available tools
  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: TOOLS,
  }));

  // Handle tool calls
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    // Wrap entire tool execution for automatic retry on 401
    const executeTool = async () => {
      switch (name) {
        // =====================================================================
        // CALENDAR TOOLS
        // =====================================================================
        case 'teamleader_events_list': {
          const filter = args as calendar.EventsListFilter;
          const result = await calendar.listEvents(client, filter);
          return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
        }
        case 'teamleader_event_info': {
          const { id } = args as { id: string };
          const result = await calendar.getEventInfo(client, id);
          return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
        }
        case 'teamleader_event_create': {
          const input = args as calendar.EventCreateInput;
          const result = await calendar.createEvent(client, input);
          return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
        }
        
        // =====================================================================
        // CONTACTS TOOLS
        // =====================================================================
        case 'teamleader_contacts_list': {
          const filter = args as contacts.ContactsListFilter;
          const result = await contacts.listContacts(client, filter);
          return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
        }
        case 'teamleader_contact_info': {
          const { id } = args as { id: string };
          const result = await contacts.getContactInfo(client, id);
          return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
        }
        
        // =====================================================================
        // COMPANIES TOOLS
        // =====================================================================
        case 'teamleader_companies_list': {
          const filter = args as companies.CompaniesListFilter;
          const result = await companies.listCompanies(client, filter);
          return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
        }
        case 'teamleader_company_info': {
          const { id } = args as { id: string };
          const result = await companies.getCompanyInfo(client, id);
          return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
        }
        case 'teamleader_company_create': {
          const input = args as companies.CompanyCreateInput;
          const result = await companies.createCompany(client, input);
          return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
        }
        case 'teamleader_company_update': {
          const input = args as companies.CompanyUpdateInput;
          await companies.updateCompany(client, input);
          return { content: [{ type: 'text', text: 'Company updated successfully' }] };
        }
        
        // =====================================================================
        // DEALS TOOLS
        // =====================================================================
        case 'teamleader_deals_list': {
          const { customer_type, customer_id, ...rest } = args as Record<string, unknown>;
          const filter: deals.DealsListFilter = { ...rest };
          if (customer_type && customer_id) {
            filter.customer = { type: customer_type as 'contact' | 'company', id: customer_id as string };
          }
          const result = await deals.listDeals(client, filter);
          return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
        }
        case 'teamleader_deal_info': {
          const { id } = args as { id: string };
          const result = await deals.getDealInfo(client, id);
          return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
        }
        case 'teamleader_deal_create': {
          const { customer_type, customer_id, estimated_value, ...rest } = args as Record<string, unknown>;
          const input: deals.DealCreateInput = {
            ...rest as Omit<deals.DealCreateInput, 'lead' | 'estimated_value'>,
            lead: {
              customer: { type: customer_type as 'contact' | 'company', id: customer_id as string },
            },
          };
          if (estimated_value) {
            input.estimated_value = { amount: estimated_value as number, currency: 'EUR' };
          }
          const result = await deals.createDeal(client, input);
          return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
        }
        case 'teamleader_deal_update': {
          const { estimated_value, ...rest } = args as Record<string, unknown>;
          const input: deals.DealUpdateInput = { ...rest as deals.DealUpdateInput };
          if (estimated_value) {
            input.estimated_value = { amount: estimated_value as number, currency: 'EUR' };
          }
          await deals.updateDeal(client, input);
          return { content: [{ type: 'text', text: 'Deal updated successfully' }] };
        }
        case 'teamleader_deal_move': {
          const { id, phase_id } = args as { id: string; phase_id: string };
          await deals.moveDeal(client, id, phase_id);
          return { content: [{ type: 'text', text: 'Deal moved successfully' }] };
        }
        case 'teamleader_deal_win': {
          const { id } = args as { id: string };
          await deals.winDeal(client, id);
          return { content: [{ type: 'text', text: 'Deal marked as won' }] };
        }
        case 'teamleader_deal_lose': {
          const { id, reason_id, extra_info } = args as { id: string; reason_id?: string; extra_info?: string };
          await deals.loseDeal(client, id, reason_id, extra_info);
          return { content: [{ type: 'text', text: 'Deal marked as lost' }] };
        }
        
        // =====================================================================
        // INVOICES TOOLS
        // =====================================================================
        case 'teamleader_invoices_list': {
          const { customer_type, customer_id, page_size, page_number, ...rest } = args as Record<string, unknown>;
          const filter: invoices.InvoicesListFilter = { ...rest };
          
          // Fix: Convert string status to array if needed
          if (filter.status && typeof filter.status === 'string') {
            filter.status = [filter.status as ('draft' | 'outstanding' | 'matched')];
          }
          
          if (customer_type && customer_id) {
            filter.customer = { type: customer_type as 'contact' | 'company', id: customer_id as string };
          }
          
          // Add pagination if provided
          const page = (page_size || page_number) ? {
            size: page_size as number || 20,
            number: page_number as number || 1
          } : undefined;
          
          const result = await invoices.listInvoices(client, filter, page);
          return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
        }
        case 'teamleader_invoice_info': {
          const { id } = args as { id: string };
          const result = await invoices.getInvoiceInfo(client, id);
          return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
        }
        case 'teamleader_invoice_draft': {
          const { customer_type, customer_id, payment_term_type, payment_term_days, ...rest } = args as Record<string, unknown>;
          const input: invoices.InvoiceDraftInput = {
            ...rest as Omit<invoices.InvoiceDraftInput, 'invoicee' | 'payment_term'>,
            invoicee: {
              customer: { type: customer_type as 'contact' | 'company', id: customer_id as string },
            },
            payment_term: {
              type: payment_term_type as 'cash' | 'end_of_month' | 'after_invoice_date',
              days: payment_term_days as number | undefined,
            },
          };
          const result = await invoices.draftInvoice(client, input);
          return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
        }
        case 'teamleader_invoice_send': {
          const { id, subject, body, to } = args as { id: string; subject: string; body: string; to: string[] };
          await invoices.sendInvoice(client, {
            id,
            content: { subject, body },
            recipients: { to: to.map((email: string) => ({ email })) },
          });
          return { content: [{ type: 'text', text: 'Invoice sent successfully' }] };
        }
        case 'teamleader_invoice_book': {
          const { id, on } = args as { id: string; on: string };
          await invoices.bookInvoice(client, id, on);
          return { content: [{ type: 'text', text: 'Invoice booked successfully' }] };
        }
        case 'teamleader_invoice_delete': {
          const { id } = args as { id: string };
          await invoices.deleteInvoice(client, id);
          return { content: [{ type: 'text', text: 'Invoice deleted successfully' }] };
        }
        case 'teamleader_invoice_register_payment': {
          const { id, amount, currency = 'EUR', paid_at } = args as { id: string; amount: number; currency?: string; paid_at: string };
          await invoices.registerPayment(client, id, { amount, currency }, paid_at);
          return { content: [{ type: 'text', text: 'Payment registered successfully' }] };
        }
        
        // =====================================================================
        // QUOTATIONS TOOLS
        // =====================================================================
        case 'teamleader_quotations_list': {
          const filter = args as quotations.QuotationsListFilter;
          const result = await quotations.listQuotations(client, filter);
          return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
        }
        case 'teamleader_quotation_info': {
          const { id } = args as { id: string };
          const result = await quotations.getQuotationInfo(client, id);
          return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
        }
        case 'teamleader_quotation_create': {
          const input = args as quotations.QuotationCreateInput;
          const result = await quotations.createQuotation(client, input);
          return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
        }
        case 'teamleader_quotation_update': {
          const { id, ...updateInput } = args as { id: string } & Partial<Omit<quotations.QuotationCreateInput, 'deal_id'>>;
          await quotations.updateQuotation(client, id, updateInput);
          return { content: [{ type: 'text', text: 'Quotation updated successfully' }] };
        }
        case 'teamleader_quotation_send': {
          const { quotation_ids, subject, content, to, language } = args as {
            quotation_ids: string[];
            subject: string;
            content: string;
            to: string[];
            language: string;
          };
          await quotations.sendQuotation(client, {
            quotations: quotation_ids,
            subject,
            content,
            recipients: { to: to.map((email: string) => ({ email_address: email })) },
            language,
          });
          return { content: [{ type: 'text', text: 'Quotation sent successfully' }] };
        }
        case 'teamleader_quotation_accept': {
          const { id } = args as { id: string };
          await quotations.acceptQuotation(client, id);
          return { content: [{ type: 'text', text: 'Quotation accepted' }] };
        }
        case 'teamleader_quotation_delete': {
          const { id } = args as { id: string };
          await quotations.deleteQuotation(client, id);
          return { content: [{ type: 'text', text: 'Quotation deleted' }] };
        }
        case 'teamleader_quotation_download': {
          const { id } = args as { id: string };
          const result = await quotations.downloadQuotation(client, id);
          return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
        }
        
        // =====================================================================
        // PRODUCTS TOOLS
        // =====================================================================
        case 'teamleader_products_list': {
          const filter = args as products.ProductsListFilter;
          const result = await products.listProducts(client, filter);
          return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
        }
        case 'teamleader_product_info': {
          const { id } = args as { id: string };
          const result = await products.getProductInfo(client, id);
          return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
        }
        case 'teamleader_product_create': {
          const { selling_price, purchase_price, currency, ...rest } = args as Record<string, unknown>;
          const curr = (currency as string) || 'EUR';
          const input: products.ProductCreateInput = { ...rest as Omit<products.ProductCreateInput, 'selling_price' | 'purchase_price'> };
          if (selling_price) {
            input.selling_price = { amount: selling_price as number, currency: curr };
          }
          if (purchase_price) {
            input.purchase_price = { amount: purchase_price as number, currency: curr };
          }
          const result = await products.createProduct(client, input);
          return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
        }
        case 'teamleader_product_update': {
          const { selling_price, purchase_price, currency, ...rest } = args as Record<string, unknown>;
          const curr = (currency as string) || 'EUR';
          const input: products.ProductUpdateInput = { ...rest as products.ProductUpdateInput };
          if (selling_price !== undefined) {
            input.selling_price = selling_price ? { amount: selling_price as number, currency: curr } : null;
          }
          if (purchase_price !== undefined) {
            input.purchase_price = purchase_price ? { amount: purchase_price as number, currency: curr } : null;
          }
          await products.updateProduct(client, input);
          return { content: [{ type: 'text', text: 'Product updated successfully' }] };
        }
        
        // =====================================================================
        // TIME TRACKING TOOLS
        // =====================================================================
        case 'teamleader_timetracking_list': {
          const { subject_type, subject_id, ...rest } = args as Record<string, unknown>;
          const filter: timetracking.TimeTrackingListFilter = { ...rest };
          if (subject_type && subject_id) {
            filter.subject = { type: subject_type as 'milestone' | 'ticket' | 'nextgenTask', id: subject_id as string };
          }
          const result = await timetracking.listTimeTracking(client, filter);
          return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
        }
        case 'teamleader_timetracking_info': {
          const { id } = args as { id: string };
          const result = await timetracking.getTimeTrackingInfo(client, id);
          return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
        }
        case 'teamleader_timetracking_add': {
          const { subject_type, subject_id, ...rest } = args as Record<string, unknown>;
          const input: timetracking.TimeTrackingAddInput = { ...rest as Omit<timetracking.TimeTrackingAddInput, 'subject'> };
          if (subject_type && subject_id) {
            input.subject = { type: subject_type as 'milestone' | 'ticket' | 'nextgenTask', id: subject_id as string };
          }
          const result = await timetracking.addTimeTracking(client, input);
          return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
        }
        case 'teamleader_timetracking_update': {
          const input = args as timetracking.TimeTrackingUpdateInput;
          await timetracking.updateTimeTracking(client, input);
          return { content: [{ type: 'text', text: 'Time tracking updated successfully' }] };
        }
        case 'teamleader_timetracking_delete': {
          const { id } = args as { id: string };
          await timetracking.deleteTimeTracking(client, id);
          return { content: [{ type: 'text', text: 'Time tracking deleted successfully' }] };
        }
        
        // =====================================================================
        // EMAIL TRACKING TOOLS
        // =====================================================================
        case 'teamleader_email_track': {
          const input = args as email.EmailTrackingCreateInput;
          const result = await email.trackEmail(client, input);
          return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
        }
        case 'teamleader_emails_list': {
          const filter = args as email.EmailTrackingFilter;
          const result = await email.listTrackedEmails(client, filter);
          return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
        }
        
        // =====================================================================
        // GENERIC PASSTHROUGH
        // =====================================================================
        case 'teamleader_api_call': {
          const input = args as raw.RawCallInput;
          const result = await raw.callRaw(client, input);
          return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
        }

        default:
          throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${name}`);
      }
    };
    
    try {
      // Execute with automatic retry on 401
      return await withRetry(executeTool);
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new McpError(
          ErrorCode.InvalidParams,
          `Validation error: ${error.errors.map((e) => e.message).join(', ')}`
        );
      }
      throw error;
    }
  });

  return server;
}

export async function startServer(tokenManager: TokenManager): Promise<void> {
  // Initialize token manager (loads stored tokens if available)
  await tokenManager.initialize();
  
  // Get initial access token
  const initialToken = await tokenManager.getAccessToken();
  const client = new TeamleaderClient({ accessToken: initialToken });
  
  // Create token refresh callback
  const onTokenRefresh = async (): Promise<string> => {
    tokenManager.setExpired(); // Force refresh
    await tokenManager.refresh();
    return tokenManager.getAccessToken();
  };
  
  // Create server with refresh callback (only if refresh is available)
  const server = createServer(
    client, 
    tokenManager.canRefresh() ? onTokenRefresh : undefined
  );
  
  const transport = new StdioServerTransport();
  
  await server.connect(transport);
  console.error('Teamleader MCP server started');
  
  if (tokenManager.canRefresh()) {
    console.error('Automatic token refresh enabled');
  } else {
    console.error('Static token mode (no automatic refresh)');
  }
}
