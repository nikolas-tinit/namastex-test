.PHONY: install dev start test typecheck lint clean brain-dev omni-dev help

help: ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-20s\033[0m %s\n", $$1, $$2}'

install: ## Install all dependencies
	bun install

dev: ## Start Brain in dev mode (hot reload)
	bun --watch packages/brain/src/index.ts

start: ## Start Brain in production mode
	bun packages/brain/src/index.ts

test: ## Run all tests
	bun test packages/

typecheck: ## Run TypeScript type checking
	bun run typecheck

lint: ## Run linter
	bun run lint

lint-fix: ## Fix lint issues
	bun run lint:fix

clean: ## Clean node_modules and build artifacts
	rm -rf node_modules packages/*/node_modules packages/*/dist

omni-dev: ## Start Omni in dev mode (requires Omni setup)
	cd omni && bun run dev

test-message: ## Send a test message through the Brain
	@curl -s -X POST http://localhost:8890/api/v1/admin/test-message \
		-H "Content-Type: application/json" \
		-H "x-api-key: brain-dev-key" \
		-d '{"text": "Olá, como funciona o sistema?"}' | bun -e 'const r=await Bun.stdin.json();console.log("Agent:",r.metadata?.agentUsed);console.log("Intent:",r.metadata?.intent);console.log("Response:",r.response)'

test-sales: ## Send a sales test message
	@curl -s -X POST http://localhost:8890/api/v1/admin/test-message \
		-H "Content-Type: application/json" \
		-H "x-api-key: brain-dev-key" \
		-d '{"text": "Quanto custa o plano enterprise?"}' | bun -e 'const r=await Bun.stdin.json();console.log("Agent:",r.metadata?.agentUsed);console.log("Intent:",r.metadata?.intent);console.log("Response:",r.response)'

test-ops: ## Send an ops test message
	@curl -s -X POST http://localhost:8890/api/v1/admin/test-message \
		-H "Content-Type: application/json" \
		-H "x-api-key: brain-dev-key" \
		-d '{"text": "Qual o status do sistema?"}' | bun -e 'const r=await Bun.stdin.json();console.log("Agent:",r.metadata?.agentUsed);console.log("Intent:",r.metadata?.intent);console.log("Response:",r.response)'

health: ## Check Brain health
	@curl -s http://localhost:8890/health | bun -e 'console.log(await Bun.stdin.json())'

health-deep: ## Deep health check
	@curl -s http://localhost:8890/health/deep | bun -e 'console.log(JSON.stringify(await Bun.stdin.json(), null, 2))'

agents: ## List registered agents
	@curl -s http://localhost:8890/api/v1/agents -H "x-api-key: brain-dev-key" | bun -e 'console.log(JSON.stringify(await Bun.stdin.json(), null, 2))'
