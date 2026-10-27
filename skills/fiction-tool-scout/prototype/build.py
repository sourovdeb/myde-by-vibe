import pathlib
b=pathlib.Path(__file__).parent
e=(b/'../fiction-tool-scout/scripts/engine.js').read_text()
t=(b/'web/template.html').read_text().replace('/*ENGINE*/',e)
(b/'web/index.html').write_text(t)
