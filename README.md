# Make Language Server
This is a simple language server and corresponding client for Visual Studio Code to provide better support for 
GNU Make.

## What does it do?
- Autocompletion for [implicit](https://www.gnu.org/software/make/manual/html_node/Implicit-Variables.html) and [automatic](https://www.gnu.org/software/make/manual/html_node/Automatic-Variables.html) variables, with built in documentation straight from the [GNU Make Manual](https://www.gnu.org/software/make/manual/html_node/index.html#Top). For the implicit variables, this autocompletion is context-aware: the autocompletion will automatically insert parentheses if they are being referenced, but not if they are being assigned to.

- Hover support for variable definitions. Hovering over a variable will now show you its definition.

## Installation
Install it through the Visual Studio Code marketplace, found [here](https://marketplace.visualstudio.com/items?itemName=alexclewontin.make-lsp-vscode&ssr=false#overview).