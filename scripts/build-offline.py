#!/usr/bin/env python3
"""Build a self-contained HTM, with fonts, icons, styles, JS and license notices."""
from pathlib import Path
import base64, hashlib, re, mimetypes, html
from urllib.parse import urlsplit
ROOT = Path(__file__).resolve().parents[1]
def data_uri(path):
    mime = mimetypes.guess_type(path.name)[0] or 'application/octet-stream'
    return 'data:' + mime + ';base64,' + base64.b64encode(path.read_bytes()).decode()
def css_embed(match):
    path = ROOT / urlsplit(match.group(1)).path
    text = path.read_text()
    def url_embed(m):
        rel = m.group(1).strip('"\' ')
        if rel.startswith(('data:', 'https:', '#')): return m.group(0)
        return 'url("' + data_uri((path.parent / rel).resolve()) + '")'
    return '<style>' + re.sub(r'url\(([^)]+)\)', url_embed, text) + '</style>'
page = (ROOT / 'index.html').read_text()
page = re.sub(r'<link rel="stylesheet" href="([^"]+)">', css_embed, page)
script_hashes = []
def js_embed(m):
    code = (ROOT / urlsplit(m.group(1)).path).read_text()
    code = re.sub(r'</script', r'<\\/script', code, flags=re.I)
    script_hashes.append("'sha256-" + base64.b64encode(hashlib.sha256(code.encode()).digest()).decode() + "'")
    return '<script>' + code + '</script>'
page = re.sub(r'<script src="([^"]+)"></script>', js_embed, page)
page = re.sub(r'<link rel="(?:manifest|canonical)"[^>]*>', '', page)
page = re.sub(r'href="(favicon\.svg|favicon\.ico|apple-touch-icon\.png)"', lambda m: 'href="'+data_uri(ROOT/m.group(1))+'"', page)
# Offline copies link to the current hosted version instead of downloading themselves.
# Keep the link hidden until the browser reports an online connection.
download_link = '<a class="pill-btn download-btn" href="downloads/chord-lab.htm" download="chord-lab.htm">↓ הורד לשימוש לא מקוון</a>'
online_link = '<a class="pill-btn" id="online-version" href="https://openmusictools.github.io/chord-lab/" hidden style="display:none">השתמש בגירסה העדכנית</a>'
if page.count(download_link) != 1:
    raise RuntimeError('Expected exactly one offline download link in index.html')
page = page.replace(download_link, online_link)
extra = """(function(){
  var link=document.getElementById('online-version');
  function refresh(){
    var online=navigator.onLine;
    link.hidden=!online;
    link.style.display=online?'':'none';
  }
  window.addEventListener('online',refresh);
  window.addEventListener('offline',refresh);
  refresh();
})();"""
script_hashes.append("'sha256-"+base64.b64encode(hashlib.sha256(extra.encode()).digest()).decode()+"'")
page = page.replace('</body>', '<script>'+extra+'</script></body>')
page = page.replace("script-src 'self'", 'script-src ' + ' '.join(script_hashes)).replace("style-src 'self'", "style-src 'unsafe-inline'").replace("font-src 'self'", "font-src data:").replace("img-src 'self' data:", "img-src data:")
licenses = [ROOT/'js/vendor/TONAL-LICENSE.txt', *sorted((ROOT/'assets/fonts').glob('OFL-*.txt'))]
page = page.replace('</body>', '<details class="app"><summary>רישיונות צד שלישי</summary><pre dir="ltr" style="white-space:pre-wrap">'+html.escape('\n\n'.join(f.name+'\n'+f.read_text() for f in licenses))+'</pre></details></body>')
output = ROOT/'downloads/chord-lab.htm'
output.parent.mkdir(exist_ok=True)
# Fail the build if the generated download regresses to the old download control.
assert 'href="https://openmusictools.github.io/"' in page, 'Home button must remain visible'
assert 'id="online-version"' in page, 'Latest-version button missing'
assert 'href="downloads/chord-lab.htm"' not in page, 'Download button remained in standalone file'
assert 'offline-download' not in page, 'Old re-download control remained'
output.write_text(page)
print(f'Built {output.name}: {output.stat().st_size:,} bytes')
