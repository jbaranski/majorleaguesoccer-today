.PHONY: all build test lint deploy

all: lint test build

lint:
	npm run prettier:check

test:
	PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers xvfb-run --auto-servernum npx ng test --watch=false --browsers=chromium

# build:prod injects PLACEHOLDER_API_URL into environment files before compiling
build:
	npm run update-csp
	npm run build:prod

# netlify-cli is NOT added as a devDependency -- npx downloads it at deploy time.
deploy: build
	npx netlify-cli deploy --prod --dir=dist/client/browser
