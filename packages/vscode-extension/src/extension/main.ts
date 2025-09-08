import type { LanguageClientOptions, ServerOptions } from "vscode-languageclient/node.js";
import * as vscode from "vscode";
import * as path from "node:path";
import * as fs from "node:fs";
import { LanguageClient, TransportKind } from "vscode-languageclient/node.js";
import { BuiltinFileSystemProvider } from "./builtin-files";
import { Settings } from "./settings";
import { registerCustomDecorators } from "./decorators";
import { WorkspaceDidChangePlipluginConfigNotification } from "pli-language";

let client: LanguageClient;
let settings: Settings;
let sessionPromptShown = false;

interface ConfigStatus {
  exists: boolean;
  valid: boolean;
  invalidFiles: string[];
  paths: { procGrps?: string; pgmConf?: string };
}

/**
 * Activates the VSCode extension. Registers providers, listeners, and commands,
 * and starts the language client.
 *
 * @param context VSCode extension context (subscriptions, storage, etc.)
 */
export function activate(context: vscode.ExtensionContext): void {
  BuiltinFileSystemProvider.register(context);
  settings = Settings.getInstance();
  client = startLanguageClient(context);
  context.subscriptions.push(registerOnDidOpenTextDocListener(context));

  // Register Quick Fix command handler
  context.subscriptions.push(
    vscode.commands.registerCommand("pli.configureInclude", async (document: vscode.TextDocument, missingFile: string) => {
      const workspaceFolder = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
      if (!workspaceFolder) return;

      const status = getConfigStatus(workspaceFolder);

      // If invalid config, warn and return
      if (status.invalidFiles.length > 0) {
        const choice = await vscode.window.showWarningMessage(
          `Cannot apply Quick Fix because configuration is invalid (${status.invalidFiles.join(", ")}).`,
          "Open Configuration"
        );
        if (choice === "Open Configuration" && status.paths.procGrps) {
          const doc = await vscode.workspace.openTextDocument(status.paths.procGrps);
          await vscode.window.showTextDocument(doc);
        }
        return;
      }

      // If config is valid, proceed with Smart Path Detection (scaffold)
      const fileName = path.basename(missingFile);
      const results = await vscode.workspace.findFiles(`**/${fileName}`, "**/.pliplugin/**", 5);

      if (results.length === 0) {
        vscode.window.showInformationMessage(`Could not resolve INCLUDE file '${missingFile}'.`);
        return;
      }

      const includeDir = path.relative(workspaceFolder, path.dirname(results[0].fsPath));
      const procGrpsPath = status.paths.procGrps!;

      try {
        const procGrps = JSON.parse(fs.readFileSync(procGrpsPath, "utf8"));
        const defaultGroup = procGrps.pgroups.find((g: any) => g.name === "default");
        if (defaultGroup && !defaultGroup.libs.includes(includeDir)) {
          defaultGroup.libs.push(includeDir);
          fs.writeFileSync(procGrpsPath, JSON.stringify(procGrps, null, 2));
          const choice = await vscode.window.showInformationMessage(
            `Added library path '${includeDir}' to process group 'default' in proc_grps.json`,
            "Open Configuration"
          );
          if (choice === "Open Configuration") {
            const doc = await vscode.workspace.openTextDocument(procGrpsPath);
            await vscode.window.showTextDocument(doc);
          }
        }
      } catch (err) {
        vscode.window.showErrorMessage(`Failed to update proc_grps.json: ${err}`);
      }
    })
  );

  const workspaceFolder = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
  if (workspaceFolder) {
    watchPlipluginFolder(client, workspaceFolder, context);
  }
}

/**
 * Registers a listener for when PL/I text documents are opened.
 * Handles prompting the user to create or fix configuration files.
 *
 * @param context VSCode extension context
 * @returns Disposable listener object
 */
function registerOnDidOpenTextDocListener(context: vscode.ExtensionContext) {
  const diagnostics = vscode.languages.createDiagnosticCollection("pli");
  context.subscriptions.push(diagnostics);

  const listener = vscode.workspace.onDidOpenTextDocument(async (document) => {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    if (!workspaceFolder || document.languageId !== "pli") return;

    const status = getConfigStatus(workspaceFolder);
    if (status.exists && status.valid) return;

    if (status.invalidFiles.length > 0 && !sessionPromptShown) {
      sessionPromptShown = true;
      const choice = await vscode.window.showWarningMessage(
        `PL/I configuration appears invalid (${status.invalidFiles.join(", ")}). Open the config files to inspect?`,
        "Open",
        "Dismiss",
        "Don't ask again"
      );
      if (choice === "Open" && status.paths.procGrps) {
        const doc = await vscode.workspace.openTextDocument(status.paths.procGrps);
        await vscode.window.showTextDocument(doc);
      }
      return;
    }

    if (!sessionPromptShown) {
      sessionPromptShown = true;
      const choice = await vscode.window.showInformationMessage(
        "PL/I configuration is incomplete. Would you like to create the .pliplugin folder and configuration files?",
        "Yes",
        "No",
        "Don't ask again"
      );
      if (choice === "Yes") createDefaultPliplugin(workspaceFolder, document.fileName);
      if (choice === "Don't ask again") context.workspaceState.update("pliDontAskConfig", true);
    }
  });

  return listener;
}

/**
 * Returns the status of the PL/I plugin configuration.
 * Checks for folder existence, valid JSON in required files,
 * and returns file paths for later use.
 *
 * @param workspaceFolder Path to the workspace root
 * @returns ConfigStatus object with existence, validity, invalid files, and paths
 */
function getConfigStatus(workspaceFolder: string): ConfigStatus {
  const plipluginPath = path.join(workspaceFolder, ".pliplugin");
  const paths: { procGrps?: string; pgmConf?: string } = {};
  const invalidFiles: string[] = [];

  if (!fs.existsSync(plipluginPath)) return { exists: false, valid: false, invalidFiles, paths };
  
  paths.procGrps = path.join(plipluginPath, "proc_grps.json");
  paths.pgmConf = path.join(plipluginPath, "pgm_conf.json");

  try {
    JSON.parse(fs.readFileSync(paths.procGrps, "utf8"));
  } catch {
    invalidFiles.push("proc_grps.json");
  }
  try {
    JSON.parse(fs.readFileSync(paths.pgmConf, "utf8"));
  } catch {
    invalidFiles.push("pgm_conf.json");
  }

  const valid = invalidFiles.length === 0;
  return { exists: true, valid, invalidFiles, paths };
}

/**
 * Creates a default .pliplugin folder with initial configuration files.
 *
 * @param workspaceFolder Path to the workspace root
 * @param entryFile Current PL/I source file to use as entry point
 */
function createDefaultPliplugin(
    workspaceFolder: string, 
    entryFile: string
): void {
  const plipluginPath = path.join(workspaceFolder, ".pliplugin");
  if (!fs.existsSync(plipluginPath)) {
    fs.mkdirSync(plipluginPath);
  }
  fs.writeFileSync(
    path.join(plipluginPath, "pgm_conf.json"),
    JSON.stringify({ pgms: [{ program: path.relative(workspaceFolder, entryFile), pgroup: "default" }] }, null, 2)
  );
  fs.writeFileSync(
    path.join(plipluginPath, "proc_grps.json"),
    JSON.stringify({
      pgroups: [
        {
          name: "default",
          "compiler-options": [],
          libs: ["cpy", "inc"],
          "include-extensions": [".pli", ".pl1", ".inc"],
          "implicit-builtins": ["SUBSTR"],
          "lsp-options": { "check-margins": true }
        }
      ]
    }, null, 2)
  );
  vscode.window.showInformationMessage(
    "'.pliplugin' folder and files created successfully.",
  );
}

/**
 * Deactivates the extension, stopping the language client and disposing settings.
 *
 * @returns A promise that resolves when the client stops, or undefined
 */
export function deactivate(): Thenable<void> | undefined {
  if (client) {
    return client.stop();
  }
  if (settings) {
    settings.dispose();
  }
  return undefined;
}

/**
 * Starts the PL/I language client, configuring server options and debug options.
 * Registers custom decorators.
 *
 * @param context VSCode extension context
 * @returns The initialized LanguageClient instance
 */
function startLanguageClient(context: vscode.ExtensionContext): LanguageClient {
  const serverModule = context.asAbsolutePath(path.join("out", "language", "main.cjs"));
  const debugOptions = {
    execArgv: ["--nolazy", `--inspect${process.env.DEBUG_BREAK ? "-brk" : ""}=${process.env.DEBUG_SOCKET || "6009"}`]
  };

  const serverOptions: ServerOptions = {
    run: { module: serverModule, transport: TransportKind.ipc },
    debug: { module: serverModule, transport: TransportKind.ipc, options: debugOptions }
  };

  const clientOptions: LanguageClientOptions = {
    documentSelector: [{ scheme: "*", language: "pli" }]
  };

  const client = new LanguageClient("pli", "PL/I", serverOptions, clientOptions);
  registerCustomDecorators(client, settings);
  client.start();
  return client;
}

/**
 * Sets up file system watchers for the .pliplugin folder and its JSON files.
 * Notifies the language server when changes occur so it reloads configuration.
 *
 * @param client Language client instance
 * @param workspaceFolder Path to the workspace root
 * @param context VSCode extension context
 */
function watchPlipluginFolder(
    client: LanguageClient, 
    workspaceFolder: string, 
    context: vscode.ExtensionContext
): void {
  const folderPattern = new vscode.RelativePattern(workspaceFolder, ".pliplugin");
  const filePattern = new vscode.RelativePattern(workspaceFolder, ".pliplugin/*.json");
  const folderWatcher = vscode.workspace.createFileSystemWatcher(folderPattern);
  const fileWatcher = vscode.workspace.createFileSystemWatcher(filePattern);

  // Watch for FOLDER create/delete events
  folderWatcher.onDidCreate(() => {
    client.sendNotification(WorkspaceDidChangePlipluginConfigNotification);
  });
  folderWatcher.onDidDelete(() => {
    client.sendNotification(WorkspaceDidChangePlipluginConfigNotification);
  });

  // Watch for FILE create/update/delete events
  fileWatcher.onDidChange(() => {
    client.sendNotification(WorkspaceDidChangePlipluginConfigNotification);
  });
  fileWatcher.onDidCreate(() => {
    client.sendNotification(WorkspaceDidChangePlipluginConfigNotification);
  });
  fileWatcher.onDidDelete(() => {
    client.sendNotification(WorkspaceDidChangePlipluginConfigNotification);
  });

  context.subscriptions.push(folderWatcher, fileWatcher);
}