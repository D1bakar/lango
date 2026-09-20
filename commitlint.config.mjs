/**
 * Conventional Commits, enforced in CI for every pull request.
 * See CONTRIBUTING.md for the conventions and examples.
 */
export default {
  extends: ["@commitlint/config-conventional"],
  rules: {
    "header-max-length": [2, "always", 100],
    "body-max-line-length": [1, "always", 120],
    "subject-case": [2, "never", ["sentence-case", "start-case", "pascal-case", "upper-case"]],
    "subject-full-stop": [2, "never", "."],
    "scope-enum": [
      2,
      "always",
      [
        "api",
        "web",
        "realtime",
        "types",
        "config",
        "core",
        "db",
        "ai",
        "ui",
        "content",
        "repo",
        "ci",
        "deps",
        "docs",
        "release",
      ],
    ],
  },
};
