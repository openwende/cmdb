package storage

import (
	"fmt"

	"gorm.io/gorm"
)

func MigrateResourceGraphTables(db *gorm.DB) error {
	for _, stmt := range resourceGraphDDL(db.Dialector.Name()) {
		if err := db.Exec(stmt).Error; err != nil {
			return fmt.Errorf("create resource graph tables: %w", err)
		}
	}

	return nil
}

func resourceGraphDDL(dialect string) []string {
	if dialect == "sqlite" {
		return []string{
			`CREATE TABLE IF NOT EXISTS resource_types_v2 (
				id TEXT PRIMARY KEY,
				name TEXT NOT NULL,
				display_name TEXT NOT NULL,
				category TEXT NOT NULL,
				icon TEXT,
				schema TEXT NOT NULL DEFAULT '{}',
				identity_rules TEXT NOT NULL DEFAULT '{}',
				builtin BOOLEAN NOT NULL DEFAULT FALSE,
				created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
				updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
			)`,
			`CREATE UNIQUE INDEX IF NOT EXISTS idx_resource_types_v2_name
				ON resource_types_v2 (name)`,
			`CREATE TABLE IF NOT EXISTS resources_v2 (
				id TEXT PRIMARY KEY,
				type_name TEXT NOT NULL,
				name TEXT,
				spec TEXT NOT NULL DEFAULT '{}',
				status TEXT NOT NULL DEFAULT '{}',
				labels TEXT NOT NULL DEFAULT '{}',
				source TEXT NOT NULL DEFAULT 'manual',
				source_id TEXT,
				identity_key TEXT,
				created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
				updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
				deleted_at DATETIME
			)`,
			`CREATE INDEX IF NOT EXISTS idx_resources_v2_type_name
				ON resources_v2 (type_name)`,
			`CREATE INDEX IF NOT EXISTS idx_resources_v2_identity_key
				ON resources_v2 (identity_key)`,
			`CREATE UNIQUE INDEX IF NOT EXISTS idx_resources_v2_source_unique
				ON resources_v2 (type_name, source, source_id)
				WHERE source_id IS NOT NULL`,
			`CREATE TABLE IF NOT EXISTS edges_v2 (
				id INTEGER PRIMARY KEY AUTOINCREMENT,
				from_id TEXT NOT NULL,
				to_id TEXT NOT NULL,
				rel_type TEXT NOT NULL,
				data TEXT NOT NULL DEFAULT '{}',
				created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
				updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
			)`,
			`CREATE INDEX IF NOT EXISTS idx_edges_v2_from_id
				ON edges_v2 (from_id)`,
			`CREATE INDEX IF NOT EXISTS idx_edges_v2_to_id
				ON edges_v2 (to_id)`,
			`CREATE INDEX IF NOT EXISTS idx_edges_v2_rel_type
				ON edges_v2 (rel_type)`,
			`CREATE TABLE IF NOT EXISTS events_v2 (
				id INTEGER PRIMARY KEY AUTOINCREMENT,
				event_type TEXT NOT NULL,
				resource_id TEXT,
				payload TEXT NOT NULL DEFAULT '{}',
				producer TEXT,
				occurred_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
				created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
				updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
			)`,
			`CREATE INDEX IF NOT EXISTS idx_events_v2_event_type
				ON events_v2 (event_type)`,
			`CREATE INDEX IF NOT EXISTS idx_events_v2_resource_id
				ON events_v2 (resource_id)`,
		}
	}

	return []string{
		`CREATE TABLE IF NOT EXISTS resource_types_v2 (
			id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
			name VARCHAR(100) NOT NULL,
			display_name VARCHAR(200) NOT NULL,
			category VARCHAR(50) NOT NULL,
			icon VARCHAR(50),
			schema JSONB NOT NULL DEFAULT '{}'::jsonb,
			identity_rules JSONB NOT NULL DEFAULT '{}'::jsonb,
			builtin BOOLEAN NOT NULL DEFAULT FALSE,
			created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
			updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
		)`,
		`CREATE UNIQUE INDEX IF NOT EXISTS idx_resource_types_v2_name
			ON resource_types_v2 (name)`,
		`CREATE TABLE IF NOT EXISTS resources_v2 (
			id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
			type_name VARCHAR(100) NOT NULL,
			name VARCHAR(500),
			spec JSONB NOT NULL DEFAULT '{}'::jsonb,
			status JSONB NOT NULL DEFAULT '{}'::jsonb,
			labels JSONB NOT NULL DEFAULT '{}'::jsonb,
			source VARCHAR(50) NOT NULL DEFAULT 'manual',
			source_id VARCHAR(500),
			identity_key VARCHAR(1000),
			created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
			updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
			deleted_at TIMESTAMPTZ
		)`,
		`CREATE INDEX IF NOT EXISTS idx_resources_v2_type_name
			ON resources_v2 (type_name)`,
		`CREATE INDEX IF NOT EXISTS idx_resources_v2_identity_key
			ON resources_v2 (identity_key)`,
		`CREATE UNIQUE INDEX IF NOT EXISTS idx_resources_v2_source_unique
			ON resources_v2 (type_name, source, source_id)
			WHERE source_id IS NOT NULL`,
		`CREATE INDEX IF NOT EXISTS idx_resources_v2_spec_gin
			ON resources_v2 USING GIN (spec)`,
		`CREATE INDEX IF NOT EXISTS idx_resources_v2_status_gin
			ON resources_v2 USING GIN (status)`,
		`CREATE TABLE IF NOT EXISTS edges_v2 (
			id BIGSERIAL PRIMARY KEY,
			from_id UUID NOT NULL,
			to_id UUID NOT NULL,
			rel_type VARCHAR(100) NOT NULL,
			data JSONB NOT NULL DEFAULT '{}'::jsonb,
			created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
			updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
		)`,
		`CREATE INDEX IF NOT EXISTS idx_edges_v2_from_id
			ON edges_v2 (from_id)`,
		`CREATE INDEX IF NOT EXISTS idx_edges_v2_to_id
			ON edges_v2 (to_id)`,
		`CREATE INDEX IF NOT EXISTS idx_edges_v2_rel_type
			ON edges_v2 (rel_type)`,
		`CREATE TABLE IF NOT EXISTS events_v2 (
			id BIGSERIAL PRIMARY KEY,
			event_type VARCHAR(100) NOT NULL,
			resource_id UUID,
			payload JSONB NOT NULL DEFAULT '{}'::jsonb,
			producer VARCHAR(100),
			occurred_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
			created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
			updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
		)`,
		`CREATE INDEX IF NOT EXISTS idx_events_v2_event_type
			ON events_v2 (event_type)`,
		`CREATE INDEX IF NOT EXISTS idx_events_v2_resource_id
			ON events_v2 (resource_id)`,
	}
}
