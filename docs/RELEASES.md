# Release Management Guide

This guide explains how to create and manage releases for ACME Certificates Manager.

## Semantic Versioning

We follow [Semantic Versioning](https://semver.org/) (SemVer):

```
MAJOR.MINOR.PATCH (e.g., 1.2.3)
```

- **MAJOR**: Breaking changes, incompatible API changes
- **MINOR**: New features, backwards-compatible
- **PATCH**: Bug fixes, backwards-compatible

### Version Examples

- `v1.0.0` - First stable release
- `v1.1.0` - Added new DNS provider support
- `v1.1.1` - Fixed certificate renewal bug
- `v2.0.0` - Changed API structure (breaking change)

## Creating a Release

### 1. Prepare the Release

**Update version in package.json files:**

```bash
# Backend
cd backend
npm version 1.2.3 --no-git-tag-version

# Frontend
cd ../frontend
npm version 1.2.3 --no-git-tag-version
```

**Update CHANGELOG.md** (if you maintain one):

```markdown
## [1.2.3] - 2025-10-31

### Added
- New DNS provider: Route53
- Support for wildcard certificates

### Fixed
- Certificate renewal timing issue
- Frontend timezone display bug

### Changed
- Improved error messages
```

**Commit changes:**

```bash
git add backend/package.json frontend/package.json CHANGELOG.md
git commit -m "chore: bump version to 1.2.3"
git push origin main
```

### 2. Create and Push Tag

```bash
# Create annotated tag
git tag -a v1.2.3 -m "Release v1.2.3

- Added Route53 DNS provider
- Fixed certificate renewal bug
- Improved error messages"

# Push tag to GitHub
git push origin v1.2.3
```

**Important:** The tag must start with `v` (e.g., `v1.2.3`) to trigger the release workflow.

### 3. Automated Release Process

Once you push the tag, GitHub Actions automatically:

1. ✅ Checks out the code
2. ✅ Installs dependencies
3. ✅ Builds backend (TypeScript → JavaScript)
4. ✅ Builds frontend (Angular → optimized static files)
5. ✅ Creates distribution package
6. ✅ Generates changelog from git commits
7. ✅ Creates GitHub Release with:
   - Release notes
   - Full distribution archive (`.tar.gz`)
   - Installation script (`install.sh`)
   - Automated installation instructions

### 4. Verify the Release

1. Go to your GitHub repository
2. Click on "Releases" in the right sidebar
3. Verify the new release appears with:
   - Correct version number
   - Release notes
   - Distribution files
   - Installation instructions

## Release Artifacts

Each release includes:

### 1. Full Distribution Archive

`acme-certificates-manager-v1.2.3-full.tar.gz`

Contains:
- Pre-built backend (JavaScript, ready to run)
- Pre-built frontend (optimized HTML/CSS/JS)
- Complete documentation
- Installation scripts
- Docker files

**Size:** ~50-100 MB (includes built files, no node_modules)

### 2. Installation Script

`install.sh`

Standalone automated installer for Debian/Ubuntu.

### 3. Source Code Archives

GitHub automatically creates:
- `Source code (zip)`
- `Source code (tar.gz)`

These include the raw source code without built files.

## Installation Methods

Users can install via:

### Method 1: Automated Installation (Recommended)

```bash
wget https://github.com/yourusername/acme-certificates-manager/releases/download/v1.2.3/install.sh
chmod +x install.sh
sudo ./install.sh v1.2.3
```

### Method 2: Manual from Distribution Archive

```bash
# Download
wget https://github.com/yourusername/acme-certificates-manager/releases/download/v1.2.3/acme-certificates-manager-v1.2.3-full.tar.gz

# Extract
tar -xzf acme-certificates-manager-v1.2.3-full.tar.gz
cd acme-certificates-manager-v1.2.3-full

# Follow deployment guide
cat docs/DEPLOYMENT.md
```

### Method 3: Docker

```bash
wget https://github.com/yourusername/acme-certificates-manager/releases/download/v1.2.3/docker-compose.yml
docker-compose up -d
```

### Method 4: Build from Source

```bash
# Clone repository
git clone https://github.com/yourusername/acme-certificates-manager.git
cd acme-certificates-manager
git checkout v1.2.3

# Build manually
cd backend && npm install && npm run build
cd ../frontend && npm install && npm run build
```

## Release Checklist

Before creating a release:

- [ ] All tests pass
- [ ] Documentation is up to date
- [ ] README.md reflects current features
- [ ] CHANGELOG.md is updated (if maintained)
- [ ] Version numbers updated in package.json files
- [ ] Breaking changes are documented
- [ ] Security issues are addressed
- [ ] Dependencies are up to date
- [ ] Docker images build successfully
- [ ] Manual testing completed
- [ ] Known issues are documented

## Release Types

### Stable Release (v1.2.3)

- Fully tested
- Production-ready
- No known critical bugs

### Pre-release (v1.3.0-beta.1)

For testing new features:

```bash
git tag -a v1.3.0-beta.1 -m "Beta release for testing new features"
git push origin v1.3.0-beta.1
```

Mark as "pre-release" in GitHub Release UI.

### Release Candidate (v1.3.0-rc.1)

Final testing before stable:

```bash
git tag -a v1.3.0-rc.1 -m "Release candidate 1"
git push origin v1.3.0-rc.1
```

## Hotfix Releases

For urgent bug fixes in production:

1. Create hotfix branch from the release tag:
```bash
git checkout -b hotfix/v1.2.4 v1.2.3
```

2. Fix the bug and commit:
```bash
git commit -m "fix: critical security issue in certificate validation"
```

3. Update version (patch):
```bash
cd backend && npm version patch --no-git-tag-version
cd ../frontend && npm version patch --no-git-tag-version
```

4. Merge back to main:
```bash
git checkout main
git merge hotfix/v1.2.4
```

5. Create tag:
```bash
git tag -a v1.2.4 -m "Hotfix: Security patch"
git push origin main
git push origin v1.2.4
```

## Rolling Back a Release

If a release has critical issues:

### Option 1: Create a New Release

Recommended approach:

```bash
# Fix the issue
git commit -m "fix: critical issue from v1.2.3"

# Create new patch version
git tag -a v1.2.4 -m "Hotfix for v1.2.3 critical issue"
git push origin v1.2.4
```

### Option 2: Mark Release as Pre-release

In GitHub:
1. Go to the problematic release
2. Click "Edit release"
3. Check "This is a pre-release"
4. Update release notes to warn users

### Option 3: Delete Release (Last Resort)

Only if absolutely necessary:

```bash
# Delete remote tag
git push --delete origin v1.2.3

# Delete local tag
git tag -d v1.2.3
```

Then delete the GitHub Release via web UI.

**Warning:** This can break installations in progress. Only use for critical security issues.

## Updating the Install Script

The `install.sh` script is version-agnostic and downloads the specified version:

```bash
sudo ./install.sh v1.2.3  # Specific version
sudo ./install.sh latest  # Latest release
sudo ./install.sh         # Defaults to latest
```

To update the script:

1. Modify `install.sh`
2. Test thoroughly on clean Debian/Ubuntu installations
3. Commit changes
4. The updated script will be included in the next release

## Release Automation Details

### GitHub Actions Workflow

The `.github/workflows/release.yml` workflow:

1. **Triggers:** When a tag matching `v*.*.*` is pushed
2. **Builds:** Both backend and frontend
3. **Packages:** Creates distribution archive
4. **Uploads:** Attaches files to GitHub Release
5. **Documentation:** Auto-generates release notes

### Workflow Requirements

The workflow needs:
- Node.js 20
- Write permissions to repository
- `GITHUB_TOKEN` (provided automatically)

### Customizing Release Notes

Edit `.github/workflows/release.yml` to customize the release notes template.

## Monitoring Releases

### Track Downloads

GitHub provides download statistics for each release asset:
1. Go to Releases
2. Click on a release
3. View download counts for each file

### User Feedback

Monitor for issues after release:
- GitHub Issues
- GitHub Discussions
- Community feedback channels

## Best Practices

1. **Test Before Release:** Always test on clean installations
2. **Document Changes:** Clear release notes help users
3. **Version Consistency:** Keep all package.json versions in sync
4. **Security Patches:** Release promptly for security issues
5. **Communication:** Announce major releases to users
6. **Backward Compatibility:** Avoid breaking changes in minor/patch versions
7. **Deprecation Warnings:** Give advance notice before removing features
8. **Migration Guides:** Provide upgrade instructions for breaking changes

## Example Release Workflow

Complete example of creating version 1.3.0:

```bash
# 1. Update versions
cd backend && npm version 1.3.0 --no-git-tag-version
cd ../frontend && npm version 1.3.0 --no-git-tag-version

# 2. Update CHANGELOG.md (manual)

# 3. Commit
git add backend/package.json frontend/package.json CHANGELOG.md
git commit -m "chore: bump version to 1.3.0"
git push origin main

# 4. Create and push tag
git tag -a v1.3.0 -m "Release v1.3.0

New Features:
- Added AWS Route53 DNS provider
- Support for ECC certificates
- Improved certificate renewal logic

Bug Fixes:
- Fixed timezone issues in expiration dates
- Resolved DNS verification race condition

Breaking Changes:
- None

Migration Notes:
- No manual migration required"

git push origin v1.3.0

# 5. Wait for GitHub Actions to complete
# 6. Verify release on GitHub
# 7. Test installation from release artifacts
# 8. Announce release to users
```

## Troubleshooting

### Workflow Fails

Check GitHub Actions logs:
1. Go to "Actions" tab
2. Click on failed workflow
3. Review error messages
4. Common issues:
   - Build failures (check dependencies)
   - Permission issues (check GITHUB_TOKEN)
   - Network timeouts (retry)

### Wrong Version in Release

1. Delete the tag:
```bash
git push --delete origin v1.2.3
git tag -d v1.2.3
```

2. Delete the GitHub Release via web UI
3. Fix version numbers
4. Create tag again

### Missing Files in Release

Check `.github/workflows/release.yml`:
- Verify file paths in `files:` section
- Ensure files are created during build steps
- Check workflow logs for errors

## Future Improvements

Consider adding:
- Automated testing in release workflow
- Docker image publishing to Docker Hub
- Checksums for release files (SHA256)
- GPG signatures for releases
- Changelog auto-generation from commits
- Release notifications (Slack, Discord, email)
- Homebrew formula for macOS
- APT repository for Debian/Ubuntu
- RPM packages for RHEL/CentOS

---

For questions about releases, open an issue or discussion on GitHub.
