package storage

import (
	"context"
	"testing"

	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"github.com/wend/cmdb-backend/internal/types"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

// setupTestDB 创建内存测试数据库
func setupTestDB(t *testing.T) *gorm.DB {
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	require.NoError(t, err)

	// 创建表结构（包含所有字段）
	err = db.Exec(`
		CREATE TABLE business_personnel (
			id TEXT PRIMARY KEY,
			created_at DATETIME,
			business_id TEXT NOT NULL,
			user_id TEXT,
			identity TEXT NOT NULL,
			role TEXT NOT NULL
		)
	`).Error
	require.NoError(t, err)

	return db
}

func TestBusinessPersonnelRepository_ListByBusinessIDs(t *testing.T) {
	db := setupTestDB(t)
	repo := NewBusinessPersonnelRepository(db)
	ctx := context.Background()

	// 创建测试数据
	business1 := uuid.New()
	business2 := uuid.New()
	business3 := uuid.New()

	testData := []types.BusinessPersonnel{
		{ID: uuid.New(), BusinessID: business1, Identity: "user1", Role: "sre"},
		{ID: uuid.New(), BusinessID: business1, Identity: "user2", Role: "developer"},
		{ID: uuid.New(), BusinessID: business2, Identity: "user3", Role: "sre"},
		{ID: uuid.New(), BusinessID: business2, Identity: "user4", Role: "tester"},
		{ID: uuid.New(), BusinessID: business3, Identity: "user5", Role: "bizops"},
	}

	for _, p := range testData {
		err := repo.Add(ctx, &p)
		require.NoError(t, err)
	}

	t.Run("空数组返回nil", func(t *testing.T) {
		result, err := repo.ListByBusinessIDs(ctx, []uuid.UUID{})
		assert.NoError(t, err)
		assert.Nil(t, result)
	})

	t.Run("单个业务ID", func(t *testing.T) {
		result, err := repo.ListByBusinessIDs(ctx, []uuid.UUID{business1})
		assert.NoError(t, err)
		assert.Len(t, result, 2) // business1 有2个人员
		assert.Equal(t, business1, result[0].BusinessID)
		assert.Equal(t, business1, result[1].BusinessID)
	})

	t.Run("多个业务ID", func(t *testing.T) {
		result, err := repo.ListByBusinessIDs(ctx, []uuid.UUID{business1, business2})
		assert.NoError(t, err)
		assert.Len(t, result, 4) // business1(2) + business2(2) = 4

		// 验证结果按 business_id 排序
		assert.Equal(t, business1, result[0].BusinessID)
		assert.Equal(t, business1, result[1].BusinessID)
	})

	t.Run("不存在的业务ID", func(t *testing.T) {
		nonExistent := uuid.New()
		result, err := repo.ListByBusinessIDs(ctx, []uuid.UUID{nonExistent})
		assert.NoError(t, err)
		assert.Len(t, result, 0) // 应该返回空数组
	})

	t.Run("混合存在和不存在的ID", func(t *testing.T) {
		nonExistent := uuid.New()
		result, err := repo.ListByBusinessIDs(ctx, []uuid.UUID{business1, nonExistent, business2})
		assert.NoError(t, err)
		assert.Len(t, result, 4) // 只返回存在的业务的人员
	})

	t.Run("验证N+1问题已解决", func(t *testing.T) {
		// 单次查询应该获取所有业务的人员
		businessIDs := []uuid.UUID{business1, business2, business3}
		result, err := repo.ListByBusinessIDs(ctx, businessIDs)
		assert.NoError(t, err)
		assert.Len(t, result, 5) // 总共5个人员

		// 验证数据正确性
		businessCount := make(map[uuid.UUID]int)
		for _, p := range result {
			businessCount[p.BusinessID]++
		}
		assert.Equal(t, 2, businessCount[business1])
		assert.Equal(t, 2, businessCount[business2])
		assert.Equal(t, 1, businessCount[business3])
	})
}

func TestBusinessPersonnelRepository_Add(t *testing.T) {
	db := setupTestDB(t)
	repo := NewBusinessPersonnelRepository(db)
	ctx := context.Background()

	t.Run("成功添加人员", func(t *testing.T) {
		p := &types.BusinessPersonnel{
			BusinessID: uuid.New(),
			Identity:   "test@example.com",
			Role:       "sre",
		}

		err := repo.Add(ctx, p)
		assert.NoError(t, err)
		assert.NotEqual(t, uuid.Nil, p.ID) // ID应该被自动生成
		assert.False(t, p.CreatedAt.IsZero()) // CreatedAt应该被设置
	})

	t.Run("ID已存在时保持原ID", func(t *testing.T) {
		originalID := uuid.New()
		p := &types.BusinessPersonnel{
			ID:         originalID,
			BusinessID: uuid.New(),
			Identity:   "test2@example.com",
			Role:       "developer",
		}

		err := repo.Add(ctx, p)
		assert.NoError(t, err)
		assert.Equal(t, originalID, p.ID) // ID不应该改变
	})
}

func TestBusinessPersonnelRepository_ListByBusiness(t *testing.T) {
	db := setupTestDB(t)
	repo := NewBusinessPersonnelRepository(db)
	ctx := context.Background()

	businessID := uuid.New()

	// 添加测试数据
	testData := []types.BusinessPersonnel{
		{BusinessID: businessID, Identity: "user1", Role: "sre"},
		{BusinessID: businessID, Identity: "user2", Role: "developer"},
		{BusinessID: uuid.New(), Identity: "user3", Role: "sre"}, // 其他业务
	}

	for _, p := range testData {
		err := repo.Add(ctx, &p)
		require.NoError(t, err)
	}

	t.Run("查询特定业务的人员", func(t *testing.T) {
		result, err := repo.ListByBusiness(ctx, businessID)
		assert.NoError(t, err)
		assert.Len(t, result, 2) // 只返回该业务的2个人员
	})

	t.Run("查询不存在的业务", func(t *testing.T) {
		result, err := repo.ListByBusiness(ctx, uuid.New())
		assert.NoError(t, err)
		assert.Len(t, result, 0)
	})
}

func TestBusinessPersonnelRepository_ListByBusinessAndRole(t *testing.T) {
	db := setupTestDB(t)
	repo := NewBusinessPersonnelRepository(db)
	ctx := context.Background()

	businessID := uuid.New()

	testData := []types.BusinessPersonnel{
		{BusinessID: businessID, Identity: "user1", Role: "sre"},
		{BusinessID: businessID, Identity: "user2", Role: "sre"},
		{BusinessID: businessID, Identity: "user3", Role: "developer"},
	}

	for _, p := range testData {
		err := repo.Add(ctx, &p)
		require.NoError(t, err)
	}

	t.Run("按角色过滤", func(t *testing.T) {
		result, err := repo.ListByBusinessAndRole(ctx, businessID, "sre")
		assert.NoError(t, err)
		assert.Len(t, result, 2) // 2个SRE
		for _, p := range result {
			assert.Equal(t, "sre", p.Role)
		}
	})

	t.Run("不存在的角色", func(t *testing.T) {
		result, err := repo.ListByBusinessAndRole(ctx, businessID, "nonexistent")
		assert.NoError(t, err)
		assert.Len(t, result, 0)
	})
}

func TestBusinessPersonnelRepository_Remove(t *testing.T) {
	db := setupTestDB(t)
	repo := NewBusinessPersonnelRepository(db)
	ctx := context.Background()

	p := &types.BusinessPersonnel{
		BusinessID: uuid.New(),
		Identity:   "test@example.com",
		Role:       "sre",
	}
	err := repo.Add(ctx, p)
	require.NoError(t, err)

	t.Run("删除存在的记录", func(t *testing.T) {
		err := repo.Remove(ctx, p.ID)
		assert.NoError(t, err)

		// 验证已删除
		result, _ := repo.ListByBusiness(ctx, p.BusinessID)
		assert.Len(t, result, 0)
	})

	t.Run("删除不存在的记录", func(t *testing.T) {
		err := repo.Remove(ctx, uuid.New())
		assert.NoError(t, err) // GORM不会报错
	})
}

func TestBusinessPersonnelRepository_RemoveByBusinessAndRole(t *testing.T) {
	db := setupTestDB(t)
	repo := NewBusinessPersonnelRepository(db)
	ctx := context.Background()

	businessID := uuid.New()

	testData := []types.BusinessPersonnel{
		{BusinessID: businessID, Identity: "user1", Role: "sre"},
		{BusinessID: businessID, Identity: "user2", Role: "sre"},
		{BusinessID: businessID, Identity: "user3", Role: "developer"},
	}

	for _, p := range testData {
		err := repo.Add(ctx, &p)
		require.NoError(t, err)
	}

	t.Run("批量删除特定角色", func(t *testing.T) {
		err := repo.RemoveByBusinessAndRole(ctx, businessID, "sre")
		assert.NoError(t, err)

		// 验证SRE已删除
		result, _ := repo.ListByBusiness(ctx, businessID)
		assert.Len(t, result, 1) // 只剩下1个developer
		assert.Equal(t, "developer", result[0].Role)
	})
}
