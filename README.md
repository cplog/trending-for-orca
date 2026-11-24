# GitHub Trending for Orca

Find your next favorite GitHub project without leaving [Orca](https://orca.dev). Explore trending repositories by language and time, match your workspace, and save finds for later.

- **Match workspace** shows trending repositories for your workspace's language and follows you when you switch.
- **Saved** keeps the repositories you star in the panel.
- A **status bar item** shows today's top repository; press it to show or hide the side panel.
- Commands: "GitHub Trending: Refresh" and "GitHub Trending: Show or hide side panel".

## Access it asks for

- **Runs its own code (full access).** A panel cannot use the network, so a worker reads `github.com/trending` (GitHub has no trending API). While the plugin is enabled the worker stays running and reads that page every 30 minutes for the status bar item.
- **Read your workspaces.** Used only to find the folder of the focused workspace and look for marker files such as `package.json` or `Cargo.toml`.

It collects nothing and sends nothing anywhere except those requests to GitHub.

## Develop

```
node --test test/          # one test reads github.com/trending live
orca plugin check .        # renders the scenarios in panel/panel.check.ts
orca plugin dev load .
```
