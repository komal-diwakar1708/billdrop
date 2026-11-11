export const DDL = [
  `CREATE TABLE IF NOT EXISTS users (
    id text PRIMARY KEY,
    email text NOT NULL UNIQUE,
    password_hash text NOT NULL,
    name text NOT NULL,
    business_name text NOT NULL,
    business_email text,
    business_address text,
    payment_instructions text,
    payment_link text,
    default_currency text NOT NULL DEFAULT 'USD',
    mcp_token text NOT NULL UNIQUE,
    created_at timestamptz NOT NULL DEFAULT now()
  )`,
  `CREATE TABLE IF NOT EXISTS sessions (
    token text PRIMARY KEY,
    user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at timestamptz NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS clients (
    id text PRIMARY KEY,
    user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name text NOT NULL,
    email text,
    address text,
    created_at timestamptz NOT NULL DEFAULT now()
  )`,
  `CREATE TABLE IF NOT EXISTS invoices (
    id text PRIMARY KEY,
    user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    client_id text REFERENCES clients(id) ON DELETE SET NULL,
    number text NOT NULL,
    status text NOT NULL DEFAULT 'draft',
    source text NOT NULL DEFAULT 'manual',
    currency text NOT NULL DEFAULT 'USD',
    issue_date date NOT NULL,
    due_date date NOT NULL,
    tax_rate numeric(6,3) NOT NULL DEFAULT 0,
    discount_cents integer NOT NULL DEFAULT 0,
    notes text,
    public_token text NOT NULL UNIQUE,
    sent_at timestamptz,
    viewed_at timestamptz,
    paid_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
  )`,
  `CREATE TABLE IF NOT EXISTS line_items (
    id text PRIMARY KEY,
    invoice_id text NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
    position integer NOT NULL,
    description text NOT NULL,
    quantity numeric(12,2) NOT NULL,
    unit_price_cents integer NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS activity (
    id text PRIMARY KEY,
    invoice_id text NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
    actor text NOT NULL,
    message text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
  )`,
  `CREATE INDEX IF NOT EXISTS invoices_user_idx ON invoices(user_id, created_at DESC)`,
  `CREATE INDEX IF NOT EXISTS clients_user_idx ON clients(user_id)`,
  `CREATE INDEX IF NOT EXISTS line_items_invoice_idx ON line_items(invoice_id, position)`,
  `CREATE INDEX IF NOT EXISTS activity_invoice_idx ON activity(invoice_id, created_at)`,
];
