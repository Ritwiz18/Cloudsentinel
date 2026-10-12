# Contributing to CloudSentinel

Thank you for contributing to CloudSentinel. Please adhere to the following guidelines to maintain security and code quality.

## Development Workflow

1. **Branching Strategy**:
   - `main`: Production-ready, stable codebase.
   - `feature/<feature-name>`: New capabilities or rules.
   - `fix/<bug-name>`: Bug fixes and security patches.

2. **Commits & PRs**:
   - Write clear, imperative commit messages.
   - Run all test suites (`pytest` and frontend tests) before pushing.
   - Ensure linting and formatting standards pass.

3. **Security Standards**:
   - **Never commit secrets**: Check git diffs before committing. Secrets must be supplied via `.env` or CI secrets.
   - **Idempotency**: All ingestion endpoints must handle duplicate events safely.
   - **Timestamps**: All timestamps must be in UTC ISO-8601 format.
   - **Safe Remediation**: Do not implement automatic destructive actions without human-in-the-loop validation.

4. **Testing**:
   - Add unit tests for every new detection rule, model, or API endpoint.
   - Target minimum 80% test coverage on backend services.
