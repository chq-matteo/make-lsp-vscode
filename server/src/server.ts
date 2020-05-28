/*
 * --------------------------------------------------------------------------------------------
 * Original work Copyright (c) Microsoft Corporation. All rights reserved.
 * Modified work Copyright (c) Alex C. Lewontin. All rights reserved.
 * See LICENSE for license information.
 * ------------------------------------------------------------------------------------------ */

import {
	createConnection,
	TextDocuments,
	CompletionParams,
	ProposedFeatures,
	InitializeParams,
	DidChangeConfigurationNotification,
	CompletionItem,
	TextDocumentPositionParams,
	TextDocumentSyncKind,
	MarkupKind,
	DocumentSymbolParams,
	ReferenceParams,
	SymbolInformation,
	DocumentSymbol,
	Position,
	Range,
	Location,
	VersionedTextDocumentIdentifier,
	SymbolKind
} from 'vscode-languageserver';

import URI from 'vscode-uri';

// Create a connection for the server. The connection uses Node's IPC as a transport.
// Also include all preview / proposed LSP features.
let connection = createConnection(ProposedFeatures.all);

// Create a simple text document manager. The text document manager
// supports full document sync only
let documents: TextDocuments = new TextDocuments();
let symMap: Map<string, DocumentSymbol[]> = new Map();


let hasConfigurationCapability: boolean = false;
let hasWorkspaceFolderCapability: boolean = false;

connection.onInitialize((params: InitializeParams) => {
	console.log('starting make lsp');
	let capabilities = params.capabilities;

	// Does the client support the `workspace/configuration` request?
	// If not, we will fall back using global settings
	hasConfigurationCapability = !!(capabilities.workspace && !!capabilities.workspace.configuration);
	hasWorkspaceFolderCapability = !!(capabilities.workspace && !!capabilities.workspace.workspaceFolders);

	return {
		capabilities: {
			textDocumentSync: TextDocumentSyncKind.Full,
			documentSymbolProvider: true,
			referencesProvider: true,
			definitionProvider: true,
			completionProvider: {
				resolveProvider: true,
				triggerCharacters: ['$']
			}
		}
	};
});

connection.onInitialized(() => {
	if (hasConfigurationCapability) {
		// Register for all configuration changes.
		connection.client.register(DidChangeConfigurationNotification.type, undefined);
	}
	if (hasWorkspaceFolderCapability) {
		connection.workspace.onDidChangeWorkspaceFolders(_event => {
			connection.console.log('Workspace folder change event received.');
		});
	}
});

documents.onDidChangeContent(async change => {
	// symMap.delete(change.document.uri);
	let document = documents.get(change.document.uri);
	if (!document) return;
	let symbols = [];
	let search_pattern = /^([^#\s]*?)(:\s)(.*?)$/m;
	let dependency_pattern = /([^\s]+)/g;
	for (let i = 0; i < document.lineCount; i++) {
		dependency_pattern.lastIndex = 0;
		search_pattern.lastIndex = 0;
		dependency_pattern.lastIndex = 0;
		let line = document.getText(Range.create(Position.create(i, 0), Position.create(i+1, 0)));
		// console.log(line)
		let match = search_pattern.exec(line);
		if (match) {
			console.log(match)
			let principal = match[1].trim();
			let dependencies = match[3].trim();
			let start = match.index;
			let end = start + principal.length;
			let symbol = new DocumentSymbol();
			symbol.name = principal;
			symbol.kind = SymbolKind.Function;
			symbol.range = Range.create(Position.create(i, start), Position.create(i, end));
			symbol.children = [];
			symbol.selectionRange = symbol.range;
			symbols.push(symbol);
			let dependency_match = dependency_pattern.exec(dependencies);
			let dependency_start = match.index + match[1].length + match[2].length;
			while (dependency_match) {
				let dependency_symbol = new DocumentSymbol();
				dependency_symbol.name = dependency_match[0].trim();
				dependency_symbol.kind = SymbolKind.Function;
				dependency_symbol.range = Range.create(Position.create(i, dependency_start + dependency_match.index), Position.create(i, dependency_start + dependency_match.index + dependency_symbol.name.length));
				dependency_symbol.selectionRange = dependency_symbol.range;
				symbol.children.push(dependency_symbol);
				dependency_match = dependency_pattern.exec(dependencies);
			}
		}
	}
	symMap.set(change.document.uri, symbols);
});

function inside(range: { start: Position, end: Position }, position: Position) {
	return (range.start.line < position.line || (range.start.line == position.line && range.start.character < position.character) && (range.end.line > position.line || (range.end.line == position.line && range.end.character > position.character)));
}
connection.onReferences(async (params: ReferenceParams) => {
	console.log('I need references');
	let syms = symMap.get(params.textDocument.uri);
	if (!syms) return [];
	for (let sym of syms) {
		if (sym.range.start.line === params.position.line) {
			if (!sym.children) return [];
			for (let child of sym.children) {
				if (inside(child.range, params.position)) {
					for (let parent of syms) {
						if (parent.name == child.name) {
							console.log(parent);
							return [Location.create(params.textDocument.uri, parent.range)];
						}
					}
				}
			}
		}
	}
	return [];
});
connection.onDefinition(async (params: TextDocumentPositionParams) => {
	console.log('I need references');
	let syms = symMap.get(params.textDocument.uri);
	if (!syms) return [];
	for (let sym of syms) {
		if (sym.range.start.line === params.position.line) {
			if (!sym.children) return [];
			for (let child of sym.children) {
				if (inside(child.range, params.position)) {
					for (let parent of syms) {
						if (parent.name == child.name) {
							console.log(parent);
							return [Location.create(params.textDocument.uri, parent.range)];
						}
					}
				}
			}
		}
	}
	return [];
});

connection.onDocumentSymbol(async (params: DocumentSymbolParams) => {
	console.log('I need symbols');

	let syms = symMap.get(params.textDocument.uri);
	console.log(syms);
	return syms;
});

// This handler provides the initial list of the completion items.
connection.onCompletion((_completionInfo: CompletionParams): CompletionItem[] => {

	let vars = require("../data/variables.json");

	if (_completionInfo.context && _completionInfo.context.triggerCharacter === '$') {
		vars.forEach((value: any) => { value.insertText = value.data.refInsertText; });
	} else {
		vars = vars.filter((value: any) => { return (value.data.defInsertText); });
		vars.forEach((value: any) => { value.insertText = value.data.defInsertText; });
	}
	return vars;

});

// This handler resolves additional information for the item selected in
// the completion list.
connection.onCompletionResolve((_item: CompletionItem): CompletionItem => {

	let docs = require("../data/documentation.json");
	_item.documentation = docs[_item.data.def].documentation;
	return _item;

});






// Make the text document manager listen on the connection
// for open, change and close text document events
documents.listen(connection);

// Listen on the connection
connection.listen();