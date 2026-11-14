.PHONY: sync-plugins build-local

PLUGINS := jeff-plugin-angular jeff-plugin-aws-solution-architect jeff-plugin-project jeff-plugin-typescript jeff-plugin-tailwind jeff-plugin-shell-bash

sync-plugins:
	@mkdir -p .claude/agents .claude/skills
	@TMPDIR=$$(mktemp -d) && \
	  trap 'rm -rf "$$TMPDIR"' EXIT && \
	  git clone --quiet --depth=1 https://github.com/jbaranski/jeff-claude.git "$$TMPDIR" && \
	  for plugin in $(PLUGINS); do \
	    src="$$TMPDIR/plugins/$$plugin"; \
	    if [ ! -d "$$src" ]; then echo "Unknown plugin: $$plugin" >&2; exit 1; fi; \
	    for agent in "$$src"/agents/*.md; do \
	      [ -e "$$agent" ] || continue; \
	      cp -L "$$agent" .claude/agents/; \
	    done; \
	    for skill in "$$src"/skills/*; do \
	      [ -e "$$skill" ] || continue; \
	      rm -rf ".claude/skills/$$(basename "$$skill")"; \
	      cp -RL "$$skill" .claude/skills/; \
	    done; \
	  done
	@echo "Synced agents to .claude/agents/ and skills to .claude/skills/"

# Build the full pipeline locally and open the pre-rendered email HTML.
# Usage:
#   make build-local            # use today's date (ET)
#   make build-local DATE=2025-05-10  # use a specific past date
build-local:
	npm ci
	npm run build
	TZ=America/New_York DATE_OVERRIDE=$(DATE) node dist/index.js
	cd client && npm ci && npm run build:lib && npm run build:email
	@echo "Done — open client/dist/client/browser/index.html in your browser"
