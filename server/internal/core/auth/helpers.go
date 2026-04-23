package auth

import (
	"time"

	"github.com/google/uuid"
)

var nowUTC = func() time.Time {
	return time.Now().UTC()
}

var parseUUID = func(value string) (uuid.UUID, error) {
	return uuid.Parse(value)
}
