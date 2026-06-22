import re, sys

def decode(s):
    return re.sub(r'\\u([0-9A-Fa-f]{4})', lambda m: chr(int(m.group(1), 16)), s)

with open('src/lib/translations.ts', encoding='utf-8') as f:
    content = f.read()

# Check all \u escapes are well-formed
bad = re.findall(r'\\u(?![0-9A-Fa-f]{4})', content)
print(f"Malformed escapes: {len(bad)}")

# Print every kn: section value for visual spot-check
kn_start = content.find('kn: {')
kn_end = content.find('\n  },\n} as const')
if kn_end == -1:
    kn_end = len(content)
kn_section = content[kn_start:kn_end]
decoded = decode(kn_section)
print(decoded[:4000])
