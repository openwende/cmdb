package types

import (
	"testing"

	"github.com/google/uuid"
	"github.com/stretchr/testify/require"
)

func TestStringArraySQLRoundTrip(t *testing.T) {
	input := StringArray{"10.0.0.1", "10.0.0.2"}

	value, err := input.Value()
	require.NoError(t, err)

	var output StringArray
	require.NoError(t, output.Scan(value))
	require.Equal(t, input, output)
}

func TestUUIDArraySQLRoundTrip(t *testing.T) {
	input := UUIDArray{uuid.New(), uuid.New()}

	value, err := input.Value()
	require.NoError(t, err)

	var output UUIDArray
	require.NoError(t, output.Scan(value))
	require.Equal(t, input, output)
}
