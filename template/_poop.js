import * as p from "@clack/prompts";
import * as utils from "poopgen/utils";
import fs from "node:fs";
import path from "node:path";
import chalk from "chalk";
import gradient from "gradient-string";

/** @type{import("poopgen").BeforeFn} */
export async function before(ctx) {
	const whopGradient = gradient(["#FF6143", "#D9D9D9"]);

	console.log(
		whopGradient.multiline(`
                        __                     __              
  _____________  ____ _/ /____       _      __/ /_  ____  ____ 
 / ___/ ___/ _ \\/ __ \`/ __/ _ \\_____| | /| / / __ \\/ __ \\/ __ \\
/ /__/ /  /  __/ /_/ / /_/  __/_____| |/ |/ / / / / /_/ / /_/ /
\\___/_/   \\___/\\__,_/\\__/\\___/      |__/|__/_/ /_/\\____/ .___/ 
                                                      /_/      
`)
	);

	const result = await p.group(
		{
			name: () =>
				p.text({
					message: "What do you want to name your app?",
					validate: (value) => {
						if (value.trim().length === 0) {
							return "Name is required";
						}
					},
				}),
		},
		{
			onCancel: () => {
				p.cancel("cancelled");
				process.exit(0);
			},
		}
	);

	const { dir, name, packageName } = utils.parseProjectName(result.name, ctx.dir.path);

	ctx.dir.path = dir;

	// no file templating needed yet, but this is where it would be

	// ctx.data.app = {
	// 	name,
	// };

	// --- format package.json ---

	const packageJSONEntry = /** @type {import("poopgen").FileEntry} */ (
		ctx.dir.entries.find((entry) => entry.path === "package.json")
	);

	const pkg = JSON.parse(packageJSONEntry.content);

	pkg.name = packageName;

	packageJSONEntry.content = JSON.stringify(pkg, null, "\t");
}

/** @type{import("poopgen").AfterFn} */
export async function after(ctx) {
	const dest = ctx.dir.path;

	const nodePackageManager = utils.getNodePackageManager();

	const result = await p.group(
		{
			should_init_git: () =>
				p.confirm({
					message: "Initialize Git repo?",
				}),
			should_install_deps: () =>
				p.confirm({
					message: `Install dependencies with ${nodePackageManager}?`,
				}),
		},
		{
			onCancel: () => {
				p.cancel("cancelled");
				process.exit(0);
			},
		}
	);

	// init a git repo in the destination
	if (result.should_init_git) {
		await initGit(dest);
	}

	// install node modules with user's package manager in the destination
	if (result.should_install_deps) {
		const spinner = p.spinner();

		try {
			spinner.start("Installing dependencies...");

			await utils.installNodeModules(nodePackageManager, {
				cwd: dest,
			});

			spinner.stop("Successfully installed dependencies");
		} catch {
			spinner.stop("Failed to install dependencies, skipping");
		}
	}

	if (process.cwd() !== dest) {
		p.note(`cd ${path.relative(process.cwd(), dest)}`, "Next steps");
	}
}

// --- helpers ---

/**
 * @param {string} destPath
 */
async function initGit(destPath) {
	const spinner = p.spinner();

	const dirName = path.parse(destPath).name;

	spinner.start("Initializing git repository...");

	try {
		const destHasGitRepo = utils.dirHasGitRepo(destPath);
		const dirIsInsideGitRepo = await utils.dirIsInsideGitRepo(destPath);

		if (destHasGitRepo) {
			spinner.stop();

			const shouldOverwriteGit = await p.confirm({
				message: `${chalk.redBright("Warning:")} There is already a git repository. Initializing a new repository would delete the previous history. Would you like to continue?`,
				initialValue: false,
			});

			if (!shouldOverwriteGit) {
				spinner.message("Skipping git initialization.");

				return;
			}

			fs.rmSync(path.join(destPath, ".git"));
		} else if (dirIsInsideGitRepo) {
			spinner.stop();

			const shouldInitChildGitRepo = await p.confirm({
				message: `${chalk.redBright.bold(
					"Warning:"
				)} "${dirName}" is already in a git worktree. Would you still like to initialize a new git repository in this directory?`,
				initialValue: false,
			});

			if (!shouldInitChildGitRepo) {
				spinner.message("Skipping git initialization");

				return;
			}
		}

		await utils.initGit({
			cwd: destPath,
		});

		spinner.stop("Successfully intialized git repository");
	} catch {
		spinner.stop("Failed to initialize git repository, skipping");
	}
}
