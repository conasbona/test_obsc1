# ObscuraV0

## Environment Variables

This project uses environment variables for sensitive configuration such as proxy credentials. You must create a `.env` file in the project root (see `.env.example` for required variables):

```
OXYLABS_USERNAME=customer-xxxx
OXYLABS_PASSWORD=yourpasswordhere
```

Never commit your actual `.env` file to version control. Only commit `.env.example`.

## Proxy Configuration
- All proxy configuration is centralized in `core/proxy/proxy_config.js`.
- Non-sensitive defaults (host, port, upstream host) are set in code.
- Sensitive info (username, password) is loaded from environment variables.
- All scripts and modules should import proxy config from this module.

## Running Scripts
Before running scripts that require proxy access, ensure your environment is set up:
- Install dependencies: `npm install`
- Create your `.env` file with the required variables
- Run scripts as usual (e.g., `node scripts/mastertest_combined.mjs`)
