package storage

import (
	"testing"

	"github.com/stretchr/testify/require"
	"gorm.io/driver/postgres"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

func TestEscapeLike(t *testing.T) {
	require.Equal(t, `a\%b\_c\\d`, EscapeLike(`a%b_c\d`))
	require.Equal(t, "10.0.1", EscapeLike("10.0.1"))
}

func TestHostKeywordCondition(t *testing.T) {
	pg := &gorm.DB{Config: &gorm.Config{Dialector: postgres.Dialector{}}}
	cond, args, ok := HostKeywordCondition(pg, "hosts", "  Web_1% ")
	require.True(t, ok)
	require.Equal(t, `(hosts.host_name ILIKE ? ESCAPE '\' OR host(hosts.primary_ip) ILIKE ? ESCAPE '\')`, cond)
	require.Equal(t, []interface{}{`%Web\_1\%%`, `%Web\_1\%%`}, args)

	lite := &gorm.DB{Config: &gorm.Config{Dialector: sqlite.Dialector{}}}
	cond, _, ok = HostKeywordCondition(lite, "h", "x")
	require.True(t, ok)
	require.Equal(t, `(h.host_name LIKE ? ESCAPE '\' OR h.primary_ip LIKE ? ESCAPE '\')`, cond)

	for _, blank := range []string{"", "   "} {
		_, _, ok = HostKeywordCondition(pg, "hosts", blank)
		require.False(t, ok)
	}
}
