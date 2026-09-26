.PHONY: all build test lint smoke deploy

all: lint test build

lint:
	npm run prettier:check

test:
	npm run build:lib
	PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers xvfb-run --auto-servernum npx ng test --watch=false --browsers=chromium

# build:prod injects PLACEHOLDER_API_URL into environment files before compiling.
# update-csp then regenerates the script-src hashes in netlify.toml from the built index.html.
build:
	npm run build:prod
	npm run update-csp

# Loads the built site with the netlify.toml CSP in headless Chromium; fails on any violation.
smoke:
	npm run smoke:csp

# netlify-cli is NOT added as a devDependency -- npx downloads it at deploy time.
deploy: build smoke
	npx netlify-cli deploy --prod --dir=dist/client/browser
