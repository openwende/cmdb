package types

import (
	"database/sql/driver"
	"fmt"

	"github.com/google/uuid"
	"github.com/lib/pq"
)

func (a StringArray) Value() (driver.Value, error) {
	return pq.StringArray([]string(a)).Value()
}

// UUIDArray stores PostgreSQL uuid[] values while preserving JSON array output.
type UUIDArray []uuid.UUID

func (a *UUIDArray) Scan(src interface{}) error {
	var raw []string
	if err := pq.Array(&raw).Scan(src); err != nil {
		return err
	}

	out := make(UUIDArray, 0, len(raw))
	for _, value := range raw {
		id, err := uuid.Parse(value)
		if err != nil {
			return fmt.Errorf("parse uuid array value %q: %w", value, err)
		}
		out = append(out, id)
	}
	*a = out
	return nil
}

func (a UUIDArray) Value() (driver.Value, error) {
	raw := make([]string, 0, len(a))
	for _, id := range a {
		raw = append(raw, id.String())
	}
	return pq.StringArray(raw).Value()
}
