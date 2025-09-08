# Wend CMDB Backend

A modern, enterprise-grade Configuration Management Database (CMDB) backend built with Go.

## Architecture Overview

```
├── cmd/                    # Application entry points
│   ├── server/            # HTTP/gRPC server
│   └── cli/               # CLI tool
├── internal/              # Private application code
│   ├── api/               # API handlers (REST + GraphQL)
│   ├── core/              # Business logic
│   │   ├── model/         # Model management
│   │   ├── instance/      # Instance management
│   │   ├── topology/      # Business topology
│   │   ├── relation/      # Relationship management
│   │   ├── query/         # Dynamic query engine
│   │   └── audit/         # Audit logging
│   ├── storage/           # Data access layer
│   ├── auth/              # Authentication & authorization
│   ├── plugins/           # Plugin system
│   └── events/            # Event publishing
├── pkg/                   # Public libraries
│   ├── client/            # Go SDK
│   ├── config/            # Configuration
│   └── types/             # Shared types
├── api/                   # API definitions
│   ├── openapi/           # OpenAPI/Swagger specs
│   └── graphql/           # GraphQL schemas
├── deploy/                # Deployment configurations
│   ├── docker/            # Docker configurations
│   ├── helm/              # Helm charts
│   └── systemd/           # Systemd service files
├── migrations/            # Database migrations
├── scripts/               # Build and utility scripts
└── tests/                 # Integration tests
```

## Technology Stack

- **Language**: Go 1.21+
- **Database**: PostgreSQL 14+ (primary), Redis (cache)
- **API**: REST + GraphQL
- **CLI**: Cobra + Viper
- **Authentication**: JWT + RBAC (Casbin)
- **Plugins**: hashicorp/go-plugin
- **Deployment**: Docker + Helm

## Key Features

- **Multi-tenant Architecture**: Business-level isolation with cross-business management
- **Flexible Model System**: Custom models, fields, and relationships
- **Business Topology**: Hierarchical resource organization
- **Dynamic Queries**: Real-time resource grouping and filtering  
- **Audit Trail**: Complete operation logging
- **Plugin System**: Extensible authentication, notification, and data sources
- **REST + GraphQL APIs**: Simple operations via REST, complex queries via GraphQL
- **CLI Tool**: Full API coverage for automation

## Quick Start

```bash
# Start development server
make dev

# Run CLI
./bin/cmdb --help

# Run tests
make test

# Build for production
make build
```

## API Examples

### REST API
```bash
# List all businesses
curl /api/v1/businesses

# Get business topology
curl /api/v1/businesses/123/topology

# Create instance
curl -X POST /api/v1/models/host/instances -d '{...}'
```

### GraphQL API
```graphql
query {
  business(id: "123") {
    name
    topology {
      clusters {
        name
        modules {
          name
          hosts {
            ip
            status
          }
        }
      }
    }
  }
}
```

### CLI Usage
```bash
# Model management
cmdb model create --name server --group infrastructure
cmdb model field add server --name ip --type string --required

# Instance management  
cmdb instance create server --ip 192.168.1.1 --hostname web01
cmdb instance list server --filter "status=active"

# Topology operations
cmdb topology create --business prod --cluster web --module frontend
cmdb topology query --business prod --depth 3
```

## Configuration

The system uses hierarchical configuration with the following precedence:
1. Command line flags
2. Environment variables
3. Configuration file (YAML/JSON)
4. Default values

See `config/config.example.yaml` for detailed configuration options.

## Development

See [DEVELOPMENT.md](DEVELOPMENT.md) for development setup and contribution guidelines.

## License

MIT License - see [LICENSE](LICENSE) for details.