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
CLI_BINARY=bin/cmdb
DIST_DIR=dist

# Build info
VERSION ?= $(shell git describe --tags --always --dirty 2>/dev/null || echo "dev")
COMMIT ?= $(shell git rev-parse --short HEAD 2>/dev/null || echo "unknown")
BUILD_TIME ?= $(shell date -u +"%Y-%m-%dT%H:%M:%SZ")

# Go build flags
LDFLAGS=-ldflags "-X main.version=$(VERSION) -X main.commit=$(COMMIT) -X main.buildTime=$(BUILD_TIME)"

.PHONY: all build clean test deps dev server cli docker help

# Default target
all: clean deps test build

# Install dependencies
deps:
	@echo "Installing dependencies..."
	$(GOMOD) download
	$(GOMOD) verify

# Build binaries
build: build-server build-cli

build-server:
    @echo "Building server binary..."
    @mkdir -p bin
    $(GOBUILD) $(LDFLAGS) -o $(SERVER_BINARY) ./cmd/business-server

build-cli:
    @echo "Building CLI binary..."
    @mkdir -p bin
    $(GOBUILD) $(LDFLAGS) -o $(CLI_BINARY) ./cmd/cmdb

# Development
dev: deps
    @echo "Starting development server..."
    $(GOCMD) run ./cmd/business-server

# Run server
server: build-server
    @echo "Starting server..."
    ./$(SERVER_BINARY)

# Run CLI
cli: build-cli
	@echo "Running CLI..."
	./$(CLI_BINARY)

# Testing
test:
	@echo "Running unit tests..."
	$(GOTEST) -v -race -coverprofile=coverage.out ./internal/... ./pkg/...

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
	@echo "Running golangci-lint..."
	@which golangci-lint > /dev/null || (echo "Installing golangci-lint..." && $(GOCMD) install github.com/golangci/golangci-lint/cmd/golangci-lint@latest)
	golangci-lint run

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

# Docker
docker-build:
	@echo "Building Docker image..."
	docker build -t wend-cmdb:$(VERSION) .

docker-run:
	@echo "Running Docker container..."
	docker run -p 8080:8080 wend-cmdb:$(VERSION)

# Helm
helm-package:
	@echo "Packaging Helm chart..."
	helm package deploy/helm/cmdb -d deploy/helm/

helm-install:
	@echo "Installing Helm chart..."
	helm install cmdb deploy/helm/cmdb

helm-upgrade:
	@echo "Upgrading Helm chart..."
	helm upgrade cmdb deploy/helm/cmdb

# Release
release: clean lint test build
	@echo "Creating release artifacts..."
	@mkdir -p $(DIST_DIR)
	@cp $(SERVER_BINARY) $(DIST_DIR)/
	@cp $(CLI_BINARY) $(DIST_DIR)/
	@tar -czf $(DIST_DIR)/wend-cmdb-$(VERSION)-linux-amd64.tar.gz -C bin .

# Cross-compile for multiple platforms
build-cross:
    @echo "Cross-compiling for multiple platforms..."
    @mkdir -p $(DIST_DIR)
    
    # Linux AMD64
    GOOS=linux GOARCH=amd64 $(GOBUILD) $(LDFLAGS) -o $(DIST_DIR)/cmdb-server-linux-amd64 ./cmd/business-server
    GOOS=linux GOARCH=amd64 $(GOBUILD) $(LDFLAGS) -o $(DIST_DIR)/cmdb-linux-amd64 ./cmd/cmdb
    
    # Linux ARM64
    GOOS=linux GOARCH=arm64 $(GOBUILD) $(LDFLAGS) -o $(DIST_DIR)/cmdb-server-linux-arm64 ./cmd/business-server
    GOOS=linux GOARCH=arm64 $(GOBUILD) $(LDFLAGS) -o $(DIST_DIR)/cmdb-linux-arm64 ./cmd/cmdb
    
    # Darwin AMD64
    GOOS=darwin GOARCH=amd64 $(GOBUILD) $(LDFLAGS) -o $(DIST_DIR)/cmdb-server-darwin-amd64 ./cmd/business-server
    GOOS=darwin GOARCH=amd64 $(GOBUILD) $(LDFLAGS) -o $(DIST_DIR)/cmdb-darwin-amd64 ./cmd/cmdb
    
    # Darwin ARM64 (M1)
    GOOS=darwin GOARCH=arm64 $(GOBUILD) $(LDFLAGS) -o $(DIST_DIR)/cmdb-server-darwin-arm64 ./cmd/business-server
    GOOS=darwin GOARCH=arm64 $(GOBUILD) $(LDFLAGS) -o $(DIST_DIR)/cmdb-darwin-arm64 ./cmd/cmdb

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
	@echo "  build         - Build server and CLI binaries"
	@echo "  build-server  - Build server binary only"
	@echo "  build-cli     - Build CLI binary only"
	@echo "  build-cross   - Cross-compile for multiple platforms"
	@echo "  clean         - Clean build artifacts"
	@echo "  deps          - Install dependencies"
	@echo "  dev           - Start development server"
	@echo "  fmt           - Format source code"
	@echo "  generate      - Run go generate"
	@echo "  lint          - Run linters"
	@echo "  test          - Run unit tests"
	@echo "  test-coverage - Run tests with coverage report"
	@echo "  test-integration - Run integration tests"
	@echo "  vet           - Run go vet"
	@echo "  docker-build  - Build Docker image"
	@echo "  docker-run    - Run Docker container"
	@echo "  helm-package  - Package Helm chart"
	@echo "  helm-install  - Install via Helm"
	@echo "  helm-upgrade  - Upgrade via Helm"
	@echo "  release       - Create release artifacts"
	@echo "  help          - Show this help message"
