import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

type LanggraphConfig = {
  dockerfile_lines?: string[];
};

type PackageJson = {
  dependencies?: Record<string, string>;
};

function getRepoRoot(): string {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  return path.resolve(__dirname, "../..");
}

function getLanggraphConfig(): LanggraphConfig {
  const langgraphPath = path.join(getRepoRoot(), "langgraph.json");
  return JSON.parse(fs.readFileSync(langgraphPath, "utf8")) as LanggraphConfig;
}

function getPlaywrightInstallLine(config: LanggraphConfig): string | undefined {
  const dockerfileLines = config.dockerfile_lines ?? [];
  return dockerfileLines.find((line) => line.includes("playwright@"));
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function getResolvedPlaywrightVersionFromYarnLock(): string {
  const repoRoot = getRepoRoot();
  const packageJson = JSON.parse(
    fs.readFileSync(path.join(repoRoot, "package.json"), "utf8"),
  ) as PackageJson;
  const requestedPlaywrightVersion = packageJson.dependencies?.playwright;

  if (!requestedPlaywrightVersion) {
    throw new Error("Playwright dependency is missing in package.json");
  }

  const yarnLockContent = fs.readFileSync(
    path.join(repoRoot, "yarn.lock"),
    "utf8",
  );
  const pattern = new RegExp(
    `^playwright@${escapeRegExp(requestedPlaywrightVersion)}:\\n(?:.*\\n)*?\\s{2}version\\s+\"([^\"]+)\"`,
    "m",
  );
  const match = yarnLockContent.match(pattern);

  if (!match?.[1]) {
    throw new Error(
      `Could not resolve playwright@${requestedPlaywrightVersion} in yarn.lock`,
    );
  }

  return match[1];
}

describe("langgraph.json Playwright install config", () => {
  it("uses the same Playwright version as the runtime dependency", () => {
    const config = getLanggraphConfig();
    const installLine = getPlaywrightInstallLine(config);
    const resolvedPlaywrightVersion =
      getResolvedPlaywrightVersionFromYarnLock();

    expect(installLine).toBeDefined();
    expect(installLine).toContain(`playwright@${resolvedPlaywrightVersion}`);
  });

  it("installs Playwright browsers with required system dependencies", () => {
    const config = getLanggraphConfig();
    const installLine = getPlaywrightInstallLine(config);

    expect(installLine).toBeDefined();
    expect(installLine).toContain("install --with-deps");
  });
});
