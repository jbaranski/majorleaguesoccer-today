.PHONY: all build test deploy

all: test build

test:
	npx ng test --watch=false --browsers=ChromeHeadlessNoSandbox

# build:prod injects PLACEHOLDER_API_URL into environment files before compiling
build:
	npm run build:prod

# netlify-cli is NOT added as a devDependency -- npx downloads it at deploy time.
deploy: build
	npx netlify-cli deploy --prod --dir=dist/client/browser
