/* --------------------------------------------------------------------------------------------
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */
'use strict';

import {
	TextDocument
} from 'vscode-languageserver-textdocument';

import {
	CompletionItem, createConnection, Diagnostic, Hover, InitializeError, InitializeResult, MarkupKind, Range, ResponseError,
	TextDocuments, TextDocumentSyncKind, ProposedFeatures, Proposed, DiagnosticSeverity
} from 'vscode-languageserver/node';

const patterns = [
	/\b[A-Z]{2,}\b/g,
	/\b[A-Z]{3,}\b/g,
	/\b[A-Z]{4,}\b/g,
	/\b[A-Z]{5,}\b/g
];

function computeDiagnostics(content: string): Diagnostic[] {
	const result: Diagnostic[] = [];
	const lines: string[] = content.match(/^.*(\n|\r\n|\r|$)/gm);
	let lineNumber: number = 0;
	for (const line of lines) {
		const pattern = patterns[Math.floor(Math.random() * 3)];
		let match: RegExpExecArray | null;
		while (match = pattern.exec(line)) {
			result.push(
				Diagnostic.create(Range.create(lineNumber, match.index, lineNumber, match.index + match[0].length), `${match[0]} is all uppercase.`, DiagnosticSeverity.Error)
			);
		}
		lineNumber++;
	}
	return result;
}

const connection: ProposedFeatures.Connection = createConnection(ProposedFeatures.all);

connection.onInitialize((params, cancel, progress): Thenable<InitializeResult> | ResponseError<InitializeError> | InitializeResult => {
	const result: InitializeResult & { capabilities : Proposed.$DiagnosticServerCapabilities & Proposed.$NotebookDocumentSyncServerCapabilities } = {
		capabilities: {
			textDocumentSync: TextDocumentSyncKind.Incremental,
			hoverProvider: true,
			completionProvider: true,
			notebookDocumentSync: {
				notebookDocumentSelector: [{
					notebookDocumentFilter: { pattern: '**/*.ipynb'}
				}],
				mode: 'notebook'
			}
		}
	};
	return result;
});

connection.onHover((textPosition): Hover => {
	return {
		contents: {
			kind: MarkupKind.PlainText,
			value: 'foo\nbar'
		}
	};
});

connection.onCompletion((params, token): CompletionItem[] => {
	const result: CompletionItem[] = [];
	let item = CompletionItem.create('foo');
	result.push(item);
	return result;
});

const notebooks = new ProposedFeatures.NotebookDocuments(TextDocument);

function validate(cell: Proposed.NotebookCell): void {
	void connection.sendDiagnostics({ uri: cell.document, diagnostics: computeDiagnostics(notebooks.getCellTextDocument(cell).getText())});
}

function clear(cell: Proposed.NotebookCell): void {
	void connection.sendDiagnostics({ uri: cell.document, diagnostics: []});
}

notebooks.onDidOpen((notebookDocument) => {
	notebookDocument.cells.forEach(validate);
});

notebooks.onDidChange((event) => {
	if (event.cells !== undefined) {
		event.cells.added.forEach(validate);
		event.cells.changed.textContent.forEach(validate);
		event.cells.removed.forEach(clear);
	}
});

notebooks.onDidClose((notebookDocument) => {
	notebookDocument.cells.forEach(clear);
});

notebooks.listen(connection);
connection.listen();