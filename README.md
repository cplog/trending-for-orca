# GitHub Trending for Orca

A side panel for [Orca](https://orca.dev) that lists trending GitHub repositories for today, this week or this month, with an optional language filter. Click a repository name to open it.

It reads `github.com/trending` (GitHub has no trending API) from a plugin worker, so Orca asks you to approve full access when you install it. It collects nothing and sends nothing anywhere except that one request to GitHub.

## Develop

```
node --test test/          # one test hits github.com/trending live
orca plugin validate .
orca plugin dev load .
```
