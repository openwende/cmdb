# Wend CMDB Backend Makefile

# Go parameters
GOCMD=go
GOBUILD=$(GOCMD) build
GOCLEAN=$(GOCMD) clean
GOTEST=$(GOCMD) test
GOGET=$(GOCMD) get
GOMOD=$(GOCMD) mod

# Binary names
SERVER_BINARY=bin/cmdb-server
DIST_DIR=dist
DB_FILE?=./data/cmdb.db

# Build info
VERSION ?= $(shell git describe --tags --always --dirty 2>/dev/null || echo "dev")
COMMIT ?= $(shell git rev-parse --short HEAD 2>/dev/null || echo "unknown")
BUILD_TIME ?= $(shell date -u +"%Y-%m-%dT%H:%M:%SZ")

# Go build flags
LDFLAGS=-ldflags "-X main.version=$(VERSION) -X main.commit=$(COMMIT) -X main.buildTime=$(BUILD_TIME)"

.PHONY: all build clean test deps dev server help fmt vet lint
.PHONY: sqlite-dev sqlite-build sqlite-run sqlite-build-all

# Default target
all: clean deps build

# Install dependencies
deps:
	@echo "Installing dependencies..."
	$(GOMOD) download
	$(GOMOD) verify

# Build binaries
build: build-server

build-server:
	@echo "Building server binary..."
	@mkdir -p bin
	$(GOBUILD) $(LDFLAGS) -o $(SERVER_BINARY) ./cmd/business-server

# Development
dev: deps
	@echo "Starting development server..."
	$(GOCMD) run ./cmd/business-server

# Run server
server: build-server
	@echo "Starting server..."
	./$(SERVER_BINARY)

# SQLite (no Docker): run directly
sqlite-dev: deps
	@echo "Starting server in SQLite mode..."
	@mkdir -p $(dir $(DB_FILE)) bin
	DB_DRIVER=sqlite DB_NAME=$(DB_FILE) $(GOCMD) run ./cmd/business-server

sqlite-build: deps
	@echo "Building server binary for SQLite..."
	@mkdir -p bin $(dir $(DB_FILE))
	# go-sqlite3 requires CGO. Ensure a C toolchain is available on your OS.
	CGO_ENABLED?=1
	DB_DRIVER=sqlite DB_NAME=$(DB_FILE) CGO_ENABLED=$(CGO_ENABLED) $(GOBUILD) $(LDFLAGS) -o $(SERVER_BINARY) ./cmd/business-server

sqlite-run: sqlite-build
	@echo "Running server binary (SQLite mode)..."
	DB_DRIVER=sqlite DB_NAME=$(DB_FILE) ./$(SERVER_BINARY)

# Cross build for common OS/ARCH (requires CGO toolchains per target)
sqlite-build-all: deps
	@echo "Cross building server binaries for SQLite (requires CGO toolchains) ..."
	@mkdir -p $(DIST_DIR) $(dir $(DB_FILE))
	CGO_ENABLED=1 GOOS=linux  GOARCH=amd64 DB_DRIVER=sqlite DB_NAME=$(DB_FILE) $(GOBUILD) $(LDFLAGS) -o $(DIST_DIR)/cmdb-server-linux-amd64-sqlite ./cmd/business-server
	CGO_ENABLED=1 GOOS=linux  GOARCH=arm64 DB_DRIVER=sqlite DB_NAME=$(DB_FILE) $(GOBUILD) $(LDFLAGS) -o $(DIST_DIR)/cmdb-server-linux-arm64-sqlite ./cmd/business-server
	CGO_ENABLED=1 GOOS=darwin GOARCH=amd64 DB_DRIVER=sqlite DB_NAME=$(DB_FILE) $(GOBUILD) $(LDFLAGS) -o $(DIST_DIR)/cmdb-server-darwin-amd64-sqlite ./cmd/business-server
	CGO_ENABLED=1 GOOS=darwin GOARCH=arm64 DB_DRIVER=sqlite DB_NAME=$(DB_FILE) $(GOBUILD) $(LDFLAGS) -o $(DIST_DIR)/cmdb-server-darwin-arm64-sqlite ./cmd/business-server
	CGO_ENABLED=1 GOOS=windows GOARCH=amd64 DB_DRIVER=sqlite DB_NAME=$(DB_FILE) $(GOBUILD) $(LDFLAGS) -o $(DIST_DIR)/cmdb-server-windows-amd64-sqlite.exe ./cmd/business-server

# Run CLI
# Testing
test:
	@echo "Running unit tests..."
	$(GOTEST) -v ./...

test-coverage: test
	@echo "Generating coverage report..."
	$(GOCMD) tool cover -html=coverage.out -o coverage.html

# Integration tests
test-integration:
	@echo "Running integration tests..."
	$(GOTEST) -v -tags=integration ./test/integration/...

# All tests
test-all: test test-integration

# Benchmark tests
bench:
	@echo "Running benchmark tests..."
	$(GOTEST) -bench=. -benchmem ./internal/... ./pkg/...

# Linting and formatting
fmt:
	@echo "Formatting code..."
	$(GOCMD) fmt ./...

vet:
	@echo "Running go vet..."
	$(GOCMD) vet ./...

lint: fmt vet

# Generate code
generate:
	@echo "Running go generate..."
	$(GOCMD) generate ./...

# Database
db-migrate-up:
	@echo "Running database migrations..."
	@which migrate > /dev/null || (echo "Install golang-migrate first" && exit 1)
	migrate -path migrations -database "$(DATABASE_URL)" up

db-migrate-down:
	@echo "Rolling back database migrations..."
	migrate -path migrations -database "$(DATABASE_URL)" down

db-migrate-create:
	@echo "Creating new migration..."
	@read -p "Migration name: " name; \
	migrate create -ext sql -dir migrations $$name

# Release (optional)
release: clean build
	@echo "Creating release artifacts..."
	@mkdir -p $(DIST_DIR)
	@cp $(SERVER_BINARY) $(DIST_DIR)/

# Cleanup
clean:
	@echo "Cleaning up..."
	$(GOCLEAN)
	rm -rf bin/
	rm -rf $(DIST_DIR)/
	rm -f coverage.out coverage.html

# Help
help:
	@echo "Available targets:"
	@echo "  all           - Clean, install deps, test, and build"
	@echo "  build         - Build server binary"
	@echo "  build-server  - Build server binary only"
	@echo "  clean         - Clean build artifacts"
	@echo "  deps          - Install dependencies"
	@echo "  dev           - Start development server"
	@echo "  sqlite-dev    - Start dev server with SQLite (no Docker)"
	@echo "  sqlite-build  - Build server binary for SQLite"
	@echo "  sqlite-run    - Run built binary with SQLite"
	@echo "  sqlite-build-all - Cross-build binaries for Linux/Darwin/Windows (CGO toolchains required)"
	@echo "  fmt           - Format source code"
	@echo "  generate      - Run go generate"
	@echo "  lint          - Run linters"
	@echo "  test          - Run unit tests"
	@echo "  test-coverage - Run tests with coverage report"
	@echo "  test-integration - Run integration tests"
	@echo "  vet           - Run go vet"
	@echo "  release       - Create release artifacts"
	@echo "  help          - Show this help message"
