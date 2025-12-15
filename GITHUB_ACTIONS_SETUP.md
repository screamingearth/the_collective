# GitHub Actions Setup

## Issue

The workflow is failing because the repository has a policy that restricts actions to only those from the `screamingearth` organization.

**Error:**
```
The actions actions/checkout@v4 and actions/setup-node@v4 are not allowed 
in screamingearth/the_collective because all actions must be from a 
repository owned by screamingearth.
```

## Solution

You need to configure GitHub's action permissions. Go to:

1. **Repository Settings** → **Actions** → **General**
2. Under "Actions permissions", select "Allow actions and reusable workflows"
3. Under "Allow specified actions and reusable workflows", add:
   ```
   actions/*
   github/*
   ```

Or, more permissively, select "Allow all actions and reusable workflows"

## Current Workflow

The `validate.yml` workflow:
- ✅ Uses inline `git` commands instead of `actions/checkout`
- ✅ Uses system Node.js instead of `actions/setup-node`
- ✅ Does not depend on external GitHub actions

This workflow can run without any external actions, so you can also:
1. Keep the current configuration
2. Change to use fewer external dependencies (current approach)

## Alternative: Use actions/checkout if preferred

If you want to use the standard GitHub actions, the permissions need to be configured as above. The workflow would become simpler:

```yaml
steps:
  - uses: actions/checkout@v4
  - uses: actions/setup-node@v4
    with:
      node-version: '20'
```

## Current Status

The current workflow has been updated to use inline git commands and system Node.js, making it independent of external actions.
