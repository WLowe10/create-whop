import { defineConfig } from "tsup";

export default defineConfig({
	outDir: "dist",
	entry: ["./src/cli.ts"],
	format: ["esm"],
	clean: true,
	splitting: false,
});
