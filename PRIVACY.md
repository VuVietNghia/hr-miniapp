# Privacy notice

Version: 2.0.0 — 2026-08-30

HR Mini App processes Room-scoped recruitment records, job descriptions, CV and candidate evaluation data, employee lifecycle profiles and documents, email recipients/content/status metadata, company drafting context, and payroll identifiers, salary, tax, bank, contract, and probation fields.

PrivOS Room Lists, Files, and App Database remain the system of record. The application container is stateless and does not intentionally retain a local persistent copy. Access is controlled by the Room permission grants documented in `SCOPES.md`; payroll additionally requires trusted backend Owner authorization. UI visibility is not authorization.

EmailJS is an external processor for outbound HR email. Recipient name/address, subject, HTML content, configured template identifiers, and provider authentication material required for delivery are sent to EmailJS. Email delivery and Room history persistence are separate outcomes. Operators must configure their EmailJS account, retention, region, and data-processing terms appropriately.

Do not use real HR or payroll data in development or acceptance environments. Logs and acceptance evidence must contain only generated identifiers, paths, and status values, with person/contact/payroll content redacted. Runtime credentials, standalone identity files, environment files, and provider responses are excluded from source and image contexts.

Room administrators are responsible for retention and authorized deletion of Room data. The app does not silently recreate or destructively repair a failed Room store.
