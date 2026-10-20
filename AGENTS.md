# Project conventions

- Share order-history filters and payment summaries between admin and worker views; derive payment states from the ledger and preserve worker ownership restrictions to avoid divergent results or broader access.
- Interpret order-history date filters as inclusive order-creation dates in America/Bogota so UTC timestamps match business calendar days.