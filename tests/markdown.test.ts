import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  computeCursorLineCol,
  computeDocumentStats,
  computeHangingIndentCols,
  renderMarkdown,
} from "../src/core/markdown.ts";

describe("Enkel Markdown Engine", () => {
  it("computes word and character statistics accurately", () => {
    const stats = computeDocumentStats("# Enkel\n\nOpen. Write. Save.");
    assert.equal(stats.words, 5);
    assert.equal(stats.lines, 3);
  });

  it("computes cursor line and column accurately", () => {
    const text = "Primeira linha\nSegunda linha\nTerceira";
    assert.deepEqual(computeCursorLineCol(text, 0), { line: 1, col: 1 });
    assert.deepEqual(computeCursorLineCol(text, 22), { line: 2, col: 8 });
  });

  it("renders headings, bold, italic, and inline code", () => {
    const md = "# Título Principal\n\nTexto com **negrito**, *itálico* e `codigo()`.";
    const html = renderMarkdown(md);
    assert.match(html, /<h1>Título Principal<\/h1>/);
    assert.match(html, /<strong>negrito<\/strong>/);
    assert.match(html, /<em>itálico<\/em>/);
    assert.match(html, /<code>codigo\(\)<\/code>/);
  });

  it("renders interactive checklists with line indices", () => {
    const md = "- [ ] Estudar Rust\n- [x] Configurar Tauri";
    const html = renderMarkdown(md);
    assert.match(html, /<li class="task-list-item ">.*data-line="0"/);
    assert.match(html, /<li class="task-list-item checked">.*data-line="1" checked/);
  });

  it("preserves relative workspace image references via data-md-src", () => {
    const md = "![Arquitetura](assets/imagens/diagrama.png)";
    const html = renderMarkdown(md);
    assert.match(html, /data-md-src="assets\/imagens\/diagrama\.png"/);
    assert.match(html, /alt="Arquitetura"/);
  });

  it("renders fenced code blocks with syntax highlighting", () => {
    const md = "```rust\nfn main() {\n  let x = 42;\n}\n```";
    const html = renderMarkdown(md);
    assert.match(html, /<span class="code-lang-tag">rust<\/span>/);
    assert.match(html, /<span class="tok-kw">fn<\/span>/);
    assert.match(html, /<span class="tok-num">42<\/span>/);
  });

  it("blocks unsafe javascript: URLs while allowing https:// links", () => {
    const md = "[Malicioso](javascript:alert(1)) e [Seguro](https://example.com)";
    const html = renderMarkdown(md);
    assert.doesNotMatch(html, /javascript:/);
    assert.match(html, /href="https:\/\/example\.com"/);
  });

  it("computes hanging indent columns for indented lines and list items", () => {
    assert.equal(computeHangingIndentCols("Texto normal"), 0);
    assert.equal(computeHangingIndentCols("    Deus é bom"), 4);
    assert.equal(computeHangingIndentCols("\t\tDeus é bom", 2), 4);
    assert.equal(computeHangingIndentCols("  - Item de lista"), 4);
    assert.equal(computeHangingIndentCols("- [ ] Tarefa"), 6);
    assert.equal(computeHangingIndentCols("1. Primeiro"), 3);
    assert.equal(computeHangingIndentCols("    "), 0);
  });
});
