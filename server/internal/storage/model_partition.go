package storage

import (
	"fmt"
	"regexp"

	"gorm.io/gorm"

	"github.com/openwende/cmdb/server/internal/types"
)

var invalidPartitionChars = regexp.MustCompile(`[^a-zA-Z0-9_]+`)

func EnsureModelInstancePartition(db *gorm.DB, model *types.Model) error {
	if model == nil {
		return fmt.Errorf("model is required")
	}
	if db.Dialector.Name() != "postgres" {
		return nil
	}

	tableName := "model_instances_" + invalidPartitionChars.ReplaceAllString(model.Name, "_")
	sql := fmt.Sprintf(`CREATE TABLE IF NOT EXISTS "%s" PARTITION OF model_instances FOR VALUES IN ('%s');`, tableName, model.ID)
	return db.Exec(sql).Error
}
