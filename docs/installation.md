# Installation (backend)

## Requirements

Install the **pinned Node.js and npm versions** first: [prerequisites.md](./prerequisites.md).

- **Docker Engine** (optional), if you run the service from the image instead of Node on the host

After prerequisites, run `npm install` once to create `package-lock.json`, commit it, then prefer `npm ci` for reproducible installs once the lockfile is in the repo.

## Clone and install

```bash
git clone <your-system-backend-url>
cd system-backend
nvm use    # optional
npm install
cp .env.example .env   # optional
```

## Debian / production host

Use the same Node major version as development, or run the process from the [Dockerfile](../Dockerfile). See [docker.md](./docker.md).
