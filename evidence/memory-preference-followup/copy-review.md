# Saved Bot memory copy
- Scope: 8 locales × 7 keys = 56 values; 6 flat `system` keys + 1 flat `bots` key each. English matches the agreed source verbatim, including `Bot’s`; `{name}` occurs once per Bot value, nowhere else.
- Contract `/tmp/opencode/g1-memory-implementation-contract.md` SHA-256: `67f3a9681f453719871b4c7bc7318e531c8fb8dc2693f585797b35119d5cac17`; catalog baseline `f82a64800c0fffd6ebaa99e571a8af0fa4307095`, before the Projects documentary commit.
- Terminology: singular `bots.page.bot` is `Bot` in all eight catalogs; Memory references follow `bots.set.sec.memory`: Memory / Mémoire / Memoria / Gedächtnis / メモリー / 记忆 / Memória / 메모리. Existing local forms of address retained.
- Semantics: manual saved notes belong to each Bot; management points to Bot settings. Global pause affects future responses; device notes and previous messages remain. Existing history may retain earlier notes. No automatic learning, global personal Chat memory, history erasure or blanket non-storage claim.
- Adding notes remains possible while paused; the enabled condition qualifies their future use, not creation. Author review only; independent native-speaker review and UI geometry remain unverified. Coordinator integrates after the Projects documentation commit.
- Read-only baseline: all 16 catalog byte sequences matched that commit. SHA-256 below; paths `packages/i18n/locales/<locale>/{system,bots}.json`.
| Locale | system.json SHA-256 | bots.json SHA-256 |
| --- | --- | --- |
| en | `18dff6afda09dc67df5091b5a2440fc1f6b3e1d439230cd9fda6967f6be7b10a` | `53a5d35cf732010fbb7045e785821048fe7fb9ad8bc9c4b97dbdecb01f502490` |
| fr | `c63761c3053604f5fd206e3f09bc728c40015abf220c3cd0be777c6193309bdc` | `03dd9b4e027e47b9affd7ccee0c8c11499435c0fda7813c9ae52702179c224d9` |
| es | `71c7a154c0cff9049ceeeb07696d701ec44ccf53160a5d3b3d4c96d7d54ff63b` | `fd523d15b874c10354a3d3b5b5055a98c98ecdfd0c032f5b8c3fc59ee9d12612` |
| de | `cacaffee5a71bcca8b544f40a9d6fbbead5da1695ff2fdc0ba634c91e5b49e74` | `dbbb437bf236cb6926a2602fc418d66a6af0d4367d7ec5e182f9cb1295e1a6ae` |
| ja | `0b86eb32b546ac0e342bab729d9e3990a944fae9c02b694bf8d095475f0fbad7` | `a860d28622279354021d5a84ff96a57a828cbbe4b77d5d54d265ef0fa9553924` |
| zh-Hans | `3e95eeaf1470b830351ae8b36332f35cf6cf1ce44ca5e2de869bef1ccd874043` | `05794a805846d44f53c47b1789eec70aa843e0e93508ec2205a80fcb2e1f3f99` |
| pt-BR | `bb28de8fa8ee1028d7d2a717ed049bdeb0dca42a04e2c9d901b520bb39d2c82b` | `0603c856c1ac9128304aef46675e8b83766d0a3f9407aa5724d51baf37da2a3c` |
| ko | `c404abfe396c950ee8da904eb5d21d23a34fa090ace1bf5898426757efa93801` | `2e6d53f15580b1fe9cc22cf528672e68273f7eda7d1424955f07393261f40927` |
- Python file assertions: JSON parsing, all 56 values, exact English, namespace/key parity, placeholder counts and UTF-8 two-space formatting checked; no application test/build invoked. Recheck:
```sh
python3 - <<'PY'
import json, re; from pathlib import Path
p=Path('/tmp/opencode'); d=json.loads((p/'memory-copy-translations.json').read_text()); pairs=re.findall(r'^- `((?:system|bots)\.[^`]+)`: `([^`]+)`$', (p/'g1-memory-implementation-contract.md').read_text(), re.M); e={n:{k.split('.',1)[1]:v for k,v in pairs if k.startswith(n+'.')} for n in ('system','bots')}
assert len(pairs)==7 and d['en']==e and set(d)==set('en fr es de ja zh-Hans pt-BR ko'.split()); assert all(set(c)==set(e) and all(set(c[n])==set(e[n]) and all(isinstance(v,str) and v and re.findall(r'\{[^{}]*\}',v)==(['{name}'] if n=='bots' else []) for v in c[n].values()) for n in e) for c in d.values()); assert (p/'memory-copy-translations.json').read_text()==json.dumps(d,ensure_ascii=False,indent=2)+'\n'; print('PASS: 8 locales, 56 values, exact English, key/placeholder parity, UTF-8 indent 2')
PY
```
