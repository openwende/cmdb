# Multi-stage build for WEND CMDB Backend
FROM golang:1.21-alpine AS builder

# Set build arguments
ARG VERSION=dev
ARG COMMIT=unknown
ARG BUILD_TIME=unknown

# Install build dependencies
RUN apk add --no-cache git ca-certificates tzdata

# Set working directory
WORKDIR /app

# Copy go mod files
COPY go.mod go.sum ./

# Download dependencies
RUN go mod download && go mod verify

# Copy source code
COPY . .

# Build the application
RUN CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build \
    -ldflags="-w -s -X main.version=${VERSION} -X main.commit=${COMMIT} -X main.buildTime=${BUILD_TIME}" \
    -a -installsuffix cgo \
    -o cmdb-server ./cmd/server

RUN CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build \
    -ldflags="-w -s -X main.version=${VERSION} -X main.commit=${COMMIT} -X main.buildTime=${BUILD_TIME}" \
    -a -installsuffix cgo \
    -o cmdb ./cmd/cli

# Final stage
FROM alpine:3.18

# Install runtime dependencies
RUN apk --no-cache add \
    ca-certificates \
    tzdata \
    bash \
    curl \
    python3 \
    py3-pip \
    && rm -rf /var/cache/apk/*

# Create non-root user
RUN addgroup -g 1001 -S cmdb && \
    adduser -u 1001 -S cmdb -G cmdb

# Set working directory
WORKDIR /app

# Copy built binaries from builder stage
COPY --from=builder /app/cmdb-server /app/cmdb ./

# Copy configuration files
COPY --from=builder /app/configs ./configs/
COPY --from=builder /app/migrations ./migrations/
COPY --from=builder /app/docs ./docs/

# Create necessary directories
RUN mkdir -p \
    /app/data \
    /app/logs \
    /app/plugins \
    /var/log/cmdb && \
    chown -R cmdb:cmdb /app /var/log/cmdb

# Set up Python for plugins
RUN pip3 install --no-cache-dir \
    requests \
    pyyaml \
    jsonschema

# Copy example plugins
COPY --from=builder /app/examples/plugins ./examples/plugins/
RUN chmod +x examples/plugins/*/main.py

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:8080/health || exit 1

# Switch to non-root user
USER cmdb

# Expose ports
EXPOSE 8080

# Set environment variables
ENV GIN_MODE=release
ENV LOG_LEVEL=info
ENV DATA_PATH=/app/data

# Default command
CMD ["./cmdb-server"]