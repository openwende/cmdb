package resource_graph

import (
	"fmt"
	"strings"

	"github.com/wend/cmdb-backend/internal/types"
)

func MatchIdentity(rules types.IdentityRules, payload map[string]any) (string, bool) {
	for _, fields := range rules.ExternalKeys {
		if key, ok := buildIdentityKey(fields, payload); ok {
			return key, true
		}
	}

	for _, fields := range rules.UniqueKeys {
		if key, ok := buildIdentityKey(fields, payload); ok {
			return key, true
		}
	}

	return "", false
}

func buildIdentityKey(fields []string, payload map[string]any) (string, bool) {
	if len(fields) == 0 {
		return "", false
	}

	parts := make([]string, 0, len(fields))
	for _, field := range fields {
		value, ok := payload[field]
		if !ok || value == nil {
			return "", false
		}

		formatted := strings.TrimSpace(fmt.Sprint(value))
		if formatted == "" {
			return "", false
		}

		parts = append(parts, fmt.Sprintf("%s=%s", field, formatted))
	}

	return strings.Join(parts, "|"), true
}
