.PHONY: sync-plugins build-local

sync-plugins:
	@mkdir -p .claude/plugins
	@TMPDIR=$$(mktemp -d) && \
	  git clone --depth=1 https://github.com/jbaranski/jeff-claude.git $$TMPDIR && \
	  for plugin in jeff-plugin-angular jeff-plugin-aws-solution-architect jeff-plugin-typescript jeff-plugin-frontend jeff-plugin-shell-bash; do \
	    rm -rf .claude/plugins/$$plugin; \
	    cp -rL $$TMPDIR/plugins/$$plugin .claude/plugins/$$plugin 2>/dev/null || true; \
	    for skill_dir in .claude/plugins/$$plugin/skills/*/; do \
	      [ -d "$$skill_dir" ] || continue; \
	      skill=$$(basename $$skill_dir); \
	      if [ ! -f "$${skill_dir}SKILL.md" ] && [ -d "$$TMPDIR/.claude/skills/$$skill" ]; then \
	        rm -rf "$$skill_dir"; \
	        cp -r "$$TMPDIR/.claude/skills/$$skill" ".claude/plugins/$$plugin/skills/"; \
	      fi; \
	    done; \
	  done && \
	  rm -rf $$TMPDIR
	@echo "Plugins synced to .claude/plugins/"

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
