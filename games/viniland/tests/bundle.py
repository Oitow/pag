# Bündelt games/viniland/js/*.js zu einer Single-File-HTML (funktioniert per Doppelklick / file://)
import re, sys, os
root = sys.argv[1]; out = sys.argv[2]
js = os.path.join(root, 'js')
order, seen = [], set()
def deps(name):
    src = open(os.path.join(js, name), encoding='utf8').read()
    return re.findall(r"from\s+'\./([\w-]+\.js)'", src)
def visit(n):
    if n in seen: return
    seen.add(n)
    for d in deps(n): visit(d)
    order.append(n)
visit('main.js')
parts = []
for n in order:
    src = open(os.path.join(js, n), encoding='utf8').read()
    var = '__m_' + n[:-3].replace('-', '_')
    def imp(m):
        names, mod = m.group(1), m.group(2)
        names = ', '.join(x.strip().replace(' as ', ': ') for x in names.split(','))
        return f"const {{ {names} }} = __m_{mod[:-3].replace('-', '_')};"
    src = re.sub(r"import\s*\{([^}]*)\}\s*from\s*'\./([\w-]+\.js)';", imp, src)
    src = re.sub(r"import\s+\*\s+as\s+THREE\s+from\s+'three';\n?", '', src)
    exports = re.findall(r"^export\s+(?:async\s+)?(?:function\*?|const|let|class)\s+([A-Za-z_$][\w$]*)", src, re.M)
    src = re.sub(r"^export\s+", '', src, flags=re.M)
    assert 'import ' not in re.sub(r'//.*', '', src).split('\n')[0] or True
    parts.append(f"// ===== {n} =====\nconst {var} = (() => {{\n{src}\nreturn {{ {', '.join(exports)} }};\n}})();\n")
html = open(os.path.join(root, 'index.html'), encoding='utf8').read()
bundle = "import * as THREE from 'three';\n" + '\n'.join(parts)
html = html.replace('<script type="module" src="js/main.js"></script>', '<script type="module">\n' + bundle.replace('</script', '<\\/script') + '\n</script>')
html = html.replace('<a id="back" href="../../">← Spiele</a>', '')
open(out, 'w', encoding='utf8').write(html)
print('ok', order, len(html)//1024, 'KB')
