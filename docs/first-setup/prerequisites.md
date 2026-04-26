# Prerequisites (before installation)

This Git repository (**system-backend**) uses a **pinned Node.js and npm** baseline. Install the toolchain **before** [installation.md](./installation.md). The companion UI is maintained in a **separate** Git repository (**system-frontend**); it uses the **same** Node and npm versions, so one toolchain serves both if you work on both locally. The documentation index for this repo is the root [README.md](../../README.md).

## Required versions (pin these)

| Tool    | Version   | Why |
| ------- | --------- | --- |
| Node.js | **24.14.1** | Matches `.nvmrc` / team baseline; avoids subtle runtime and tooling differences. |
| npm     | **11.11.0** | Same lockfile and install behavior across machines and CI. |

After setup, verify:

```bash
node -v   # v24.14.1
npm -v    # 11.11.0
```

If either command prints a different version, finish the steps below before running `npm install` in this repository.

---

## Option A — Windows with nvm-windows (recommended)

Use this when you manage multiple Node versions on Windows or need to match the versions above exactly.

### A.1 — You already have nvm-windows

1. Install the required Node line (exact patch):

   ```text
   nvm install 24.14.1
   nvm use 24.14.1
   ```

2. Align npm to **11.11.0** (Node bundles its own npm; override it globally for this version):

   ```text
   npm install -g npm@11.11.0
   ```

3. Confirm with `node -v` and `npm -v`, then continue from the root [README.md](../../README.md) **Documentation** section.

### A.2 — You do not have nvm-windows yet

1. **Remove** any standalone “Node.js” installation from *Apps & features* (Windows), so `nvm` owns the `node` / `npm` binaries.
2. Install **nvm-windows 1.2.2** from the official release page:  
   [https://github.com/coreybutler/nvm-windows/releases/tag/1.2.2](https://github.com/coreybutler/nvm-windows/releases/tag/1.2.2)
3. **Optional:** reboot once (helps if shells still see an old `PATH`).
4. Go to **A.1** and install **24.14.1**, then pin npm as shown.

---

## Option B — macOS / Linux (nvm-sh)

If you use [nvm](https://github.com/nvm-sh/nvm) (the Unix shell version):

```bash
nvm install 24.14.1
nvm use 24.14.1
npm install -g npm@11.11.0
node -v && npm -v
```

Use the same verification as above.

---

## Option C — Official installer / other managers

You may install Node **24.14.1** from [nodejs.org](https://nodejs.org/) or another supported manager, as long as the result matches the table at the top. Still run `npm install -g npm@11.11.0` if the bundled npm is not **11.11.0**.

---

## After the toolchain is ready

1. Open the root [README.md](../../README.md) and follow the **Documentation** links (**Installation**, **Running**, **Development**) as needed.
2. For containers, see [docker.md](../docker/docker.md).

---

## Using an AI-assisted IDE

Example prompt for **this** repository only:

```text
Run the installation and development setup for this backend repository. Follow README.md and docs/ (first-setup, development, docker, api). Use Node.js 24.14.1 and npm 11.11.0 exactly as in docs/first-setup/prerequisites.md. Then run the dev server and tests as a smoke test, and build the Docker image as a smoke test.
```

If you also clone **system-frontend**, repeat its `docs/first-setup/prerequisites.md` (same versions) and its install/run docs there. Keep version pins **exactly** as documented so installs stay reproducible.
