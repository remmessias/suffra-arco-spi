#!/bin/sh
# Sobe os emuladores garantindo um Java no PATH (o emulador do Firestore exige).
if ! command -v java >/dev/null 2>&1; then
  for jre in "$HOME"/.local/java/*/Contents/Home; do
    if [ -x "$jre/bin/java" ]; then
      export JAVA_HOME="$jre"
      export PATH="$jre/bin:$PATH"
      break
    fi
  done
fi
exec npx firebase-tools emulators:start --project demo-suffra2 "$@"
