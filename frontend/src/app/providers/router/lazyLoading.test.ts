import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { build } from "vite";

interface ManifestChunk {
    isDynamicEntry?: boolean;
    src?: string;
}

const frontendRoot = resolve(import.meta.dirname, "../../../..");
const outputDirectory = mkdtempSync(resolve(tmpdir(), "avito-frontend-build-"));
let dynamicEntries: string[] = [];

beforeAll(async () => {
    await build({
        configFile: resolve(frontendRoot, "vite.config.ts"),
        root: frontendRoot,
        build: {
            emptyOutDir: true,
            manifest: true,
            outDir: outputDirectory,
        },
    });

    const manifest = JSON.parse(
        readFileSync(resolve(outputDirectory, ".vite/manifest.json"), "utf8"),
    ) as Record<string, ManifestChunk>;

    dynamicEntries = Object.values(manifest)
        .filter((chunk) => chunk.isDynamicEntry)
        .flatMap((chunk) => (chunk.src ? [chunk.src] : []))
        .sort();
}, 30_000);

afterAll(() => {
    rmSync(outputDirectory, { recursive: true, force: true });
});

describe("production bundle lazy-loading boundaries", () => {
    it("creates dynamic entries only for auth and queue modals", () => {
        expect(dynamicEntries).toEqual([
            "src/features/auth/index.ts",
            "src/widgets/purchase-queue-modal/index.ts",
        ]);
    });
});
