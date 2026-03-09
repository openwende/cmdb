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

// setupHostTestDB 创建主机测试数据库
func setupHostTestDB(t *testing.T) *gorm.DB {
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	require.NoError(t, err)

	// 创建 hosts 表
	err = db.Exec(`
		CREATE TABLE hosts (
			id TEXT PRIMARY KEY,
			created_at DATETIME,
			updated_at DATETIME,
			deleted_at DATETIME,
			tenant_id TEXT NOT NULL,
			created_by TEXT,
			updated_by TEXT,
			cloud_area_id TEXT,
			business_id TEXT,
			host_name TEXT NOT NULL,
			primary_ip TEXT NOT NULL,
			ip_addresses TEXT,
			cloud_vendor TEXT,
			cloud_instance_id TEXT,
			cloud_region TEXT,
			vpc_id TEXT,
			subnet_id TEXT,
			cpu INTEGER,
			memory INTEGER,
			disk_size INTEGER,
			os_type TEXT,
			os_version TEXT,
			status TEXT,
			is_destroyed INTEGER DEFAULT 0,
			cloud_metadata TEXT,
			custom_fields TEXT
		)
	`).Error
	require.NoError(t, err)

	// 创建云区域表
	err = db.Exec(`
		CREATE TABLE cloud_areas (
			id TEXT PRIMARY KEY,
			name TEXT NOT NULL,
			identifier TEXT NOT NULL,
			type TEXT
		)
	`).Error
	require.NoError(t, err)

	// 创建业务表（用于关联查询）
	err = db.Exec(`
		CREATE TABLE businesses (
			id TEXT PRIMARY KEY,
			deleted_at DATETIME,
			name TEXT NOT NULL,
			identifier TEXT NOT NULL,
			business_id INTEGER
		)
	`).Error
	require.NoError(t, err)

	err = db.Exec(`
		CREATE TABLE host_business_relations (
			host_id TEXT NOT NULL,
			business_id TEXT NOT NULL,
			created_at DATETIME,
			PRIMARY KEY (host_id, business_id)
		)
	`).Error
	require.NoError(t, err)

	err = db.Exec(`
		CREATE TABLE host_module_relations (
			host_id TEXT NOT NULL,
			module_id INTEGER NOT NULL,
			created_at DATETIME,
			PRIMARY KEY (host_id, module_id)
		)
	`).Error
	require.NoError(t, err)

	return db
}

func TestHostRepository_CheckIPConflict(t *testing.T) {
	db := setupHostTestDB(t)
	repo := NewHostRepository(db)
	ctx := context.Background()

	tenantID := uuid.New()
	cloudAreaID := uuid.New()

	// 创建一个已存在的主机
	existingHost := &types.Host{
		ID:          uuid.New(),
		TenantID:    tenantID,
		CloudAreaID: &cloudAreaID,
		HostName:    "existing-host",
		PrimaryIP:   "192.168.1.100",
		Status:      types.HostStatusRunning,
		IsDestroyed: false,
	}

	// 手动插入测试数据
	err := db.Create(existingHost).Error
	require.NoError(t, err)

	t.Run("相同云区域和IP冲突", func(t *testing.T) {
		conflict, err := repo.CheckIPConflict(ctx, &cloudAreaID, "192.168.1.100", nil)
		assert.NoError(t, err)
		assert.True(t, conflict, "应该检测到IP冲突")
	})

	t.Run("不同云区域相同IP不冲突", func(t *testing.T) {
		differentCloudArea := uuid.New()
		conflict, err := repo.CheckIPConflict(ctx, &differentCloudArea, "192.168.1.100", nil)
		assert.NoError(t, err)
		assert.False(t, conflict, "不同云区域不应冲突")
	})

	t.Run("相同云区域不同IP不冲突", func(t *testing.T) {
		conflict, err := repo.CheckIPConflict(ctx, &cloudAreaID, "192.168.1.200", nil)
		assert.NoError(t, err)
		assert.False(t, conflict, "不同IP不应冲突")
	})

	t.Run("排除自身ID不冲突", func(t *testing.T) {
		conflict, err := repo.CheckIPConflict(ctx, &cloudAreaID, "192.168.1.100", &existingHost.ID)
		assert.NoError(t, err)
		assert.False(t, conflict, "排除自身时不应报冲突")
	})

	t.Run("已销毁的主机不算冲突", func(t *testing.T) {
		// 标记主机为已销毁
		db.Model(&types.Host{}).Where("id = ?", existingHost.ID).Update("is_destroyed", true)

		conflict, err := repo.CheckIPConflict(ctx, &cloudAreaID, "192.168.1.100", nil)
		assert.NoError(t, err)
		assert.False(t, conflict, "已销毁的主机不应算冲突")
	})
}

func TestHostRepository_AssignToBusiness(t *testing.T) {
	db := setupHostTestDB(t)
	repo := NewHostRepository(db)
	ctx := context.Background()

	hostID := uuid.New()
	tenantID := uuid.New()
	businessID := int64(1000)
	businessUUID := uuid.New()
	cloudAreaID := uuid.New()

	// 创建测试主机（在资源池中）
	host := &types.Host{
		ID:          hostID,
		TenantID:    tenantID,
		CloudAreaID: &cloudAreaID,
		HostName:    "test-host",
		PrimaryIP:   "192.168.1.100",
		Status:      types.HostStatusRunning,
		BusinessID:  nil, // 初始在资源池
	}
	err := db.Create(host).Error
	require.NoError(t, err)
	err = db.Exec(`INSERT INTO businesses (id, name, identifier, business_id) VALUES (?, ?, ?, ?)`,
		businessUUID.String(), "biz-1000", "biz-1000", businessID).Error
	require.NoError(t, err)

	t.Run("成功分配到业务", func(t *testing.T) {
		err := repo.AssignToBusiness(ctx, hostID, businessID)
		assert.NoError(t, err)

		// 验证关系表已建立
		var cnt int64
		err = db.Table("host_business_relations").
			Where("host_id = ? AND business_id = ?", hostID, businessUUID).
			Count(&cnt).Error
		assert.NoError(t, err)
		assert.Equal(t, int64(1), cnt)
	})

	t.Run("分配不存在的主机", func(t *testing.T) {
		err := repo.AssignToBusiness(ctx, uuid.New(), businessID)
		assert.Error(t, err)
	})
}

func TestHostRepository_ReclaimToPool(t *testing.T) {
	db := setupHostTestDB(t)
	repo := NewHostRepository(db)
	ctx := context.Background()

	hostID := uuid.New()
	tenantID := uuid.New()
	businessID := int64(1001)
	businessUUID := uuid.New()
	cloudAreaID := uuid.New()

	// 创建已分配给业务的主机
	host := &types.Host{
		ID:          hostID,
		TenantID:    tenantID,
		CloudAreaID: &cloudAreaID,
		HostName:    "test-host",
		PrimaryIP:   "192.168.1.100",
		Status:      types.HostStatusRunning,
		BusinessID:  &businessID, // 已分配给业务
	}
	err := db.Create(host).Error
	require.NoError(t, err)
	err = db.Exec(`INSERT INTO businesses (id, name, identifier, business_id) VALUES (?, ?, ?, ?)`,
		businessUUID.String(), "biz-1001", "biz-1001", businessID).Error
	require.NoError(t, err)
	err = db.Exec(`INSERT INTO host_business_relations (host_id, business_id) VALUES (?, ?)`,
		hostID.String(), businessUUID.String()).Error
	require.NoError(t, err)

	t.Run("成功回收到资源池", func(t *testing.T) {
		err := repo.ReclaimToPool(ctx, hostID)
		assert.NoError(t, err)

		// 验证业务关系已清除
		var cnt int64
		err = db.Table("host_business_relations").
			Where("host_id = ?", hostID).
			Count(&cnt).Error
		assert.NoError(t, err)
		assert.Equal(t, int64(0), cnt)
	})
}

func TestHostRepository_GetHostByCloudAreaIP(t *testing.T) {
	db := setupHostTestDB(t)
	repo := NewHostRepository(db)
	ctx := context.Background()

	tenantID := uuid.New()
	cloudArea1 := uuid.New()
	cloudArea2 := uuid.New()

	// 创建两个不同云区域的主机，IP 相同
	host1 := &types.Host{
		ID:          uuid.New(),
		TenantID:    tenantID,
		CloudAreaID: &cloudArea1,
		HostName:    "host-aws",
		PrimaryIP:   "10.0.1.10",
		Status:      types.HostStatusRunning,
	}
	host2 := &types.Host{
		ID:          uuid.New(),
		TenantID:    tenantID,
		CloudAreaID: &cloudArea2,
		HostName:    "host-tencent",
		PrimaryIP:   "10.0.1.10", // 相同IP
		Status:      types.HostStatusRunning,
	}

	db.Create(host1)
	db.Create(host2)

	t.Run("按云区域和IP查询", func(t *testing.T) {
		result, err := repo.GetHostByCloudAreaIP(ctx, cloudArea1, "10.0.1.10")
		assert.NoError(t, err)
		assert.NotNil(t, result)
		assert.Equal(t, "host-aws", result.HostName)
	})

	t.Run("查询另一个云区域", func(t *testing.T) {
		result, err := repo.GetHostByCloudAreaIP(ctx, cloudArea2, "10.0.1.10")
		assert.NoError(t, err)
		assert.NotNil(t, result)
		assert.Equal(t, "host-tencent", result.HostName)
	})

	t.Run("不存在的组合", func(t *testing.T) {
		result, err := repo.GetHostByCloudAreaIP(ctx, cloudArea1, "10.0.2.20")
		assert.Error(t, err)
		assert.Nil(t, result)
	})
}

func TestHostRepository_ListHosts_ResourcePool(t *testing.T) {
	db := setupHostTestDB(t)
	repo := NewHostRepository(db)
	ctx := context.Background()

	tenantID := uuid.New()
	businessID := int64(1002)
	businessUUID := uuid.New()
	cloudAreaID := uuid.New()

	// 创建资源池主机
	poolHost := &types.Host{
		ID:          uuid.New(),
		TenantID:    tenantID,
		CloudAreaID: &cloudAreaID,
		HostName:    "pool-host",
		PrimaryIP:   "192.168.1.1",
		Status:      types.HostStatusRunning,
		BusinessID:  nil, // 在资源池
	}

	// 创建业务主机
	businessHost := &types.Host{
		ID:          uuid.New(),
		TenantID:    tenantID,
		CloudAreaID: &cloudAreaID,
		HostName:    "business-host",
		PrimaryIP:   "192.168.1.2",
		Status:      types.HostStatusRunning,
	}

	db.Create(poolHost)
	db.Create(businessHost)
	db.Exec(`INSERT INTO businesses (id, name, identifier, business_id) VALUES (?, ?, ?, ?)`,
		businessUUID.String(), "biz-1002", "biz-1002", businessID)
	db.Exec(`INSERT INTO host_business_relations (host_id, business_id) VALUES (?, ?)`,
		businessHost.ID.String(), businessUUID.String())

	t.Run("查询资源池主机", func(t *testing.T) {
		inPool := true
		params := &types.HostQueryParams{
			InPool:   &inPool,
			Page:     1,
			PageSize: 10,
		}

		hosts, total, err := repo.ListHosts(ctx, tenantID, params)
		assert.NoError(t, err)
		assert.Equal(t, int64(1), total)
		if assert.Len(t, hosts, 1) {
			assert.Equal(t, "pool-host", hosts[0].HostName)
		}
	})

	t.Run("按业务ID查询", func(t *testing.T) {
		params := &types.HostQueryParams{
			BusinessID: &businessID,
			Page:       1,
			PageSize:   10,
		}

		hosts, total, err := repo.ListHosts(ctx, tenantID, params)
		assert.NoError(t, err)
		assert.Equal(t, int64(1), total)
		if assert.Len(t, hosts, 1) {
			assert.Equal(t, "business-host", hosts[0].HostName)
		}
	})

	t.Run("按云区域查询", func(t *testing.T) {
		params := &types.HostQueryParams{
			CloudAreaID: &cloudAreaID,
			Page:        1,
			PageSize:    10,
		}

		hosts, total, err := repo.ListHosts(ctx, tenantID, params)
		assert.NoError(t, err)
		assert.Equal(t, int64(2), total) // 两个主机都在同一云区域
		assert.Len(t, hosts, 2)
	})
}

func TestHostRepository_MarkAsDestroyed(t *testing.T) {
	db := setupHostTestDB(t)
	repo := NewHostRepository(db)
	ctx := context.Background()

	hostID := uuid.New()
	tenantID := uuid.New()
	cloudAreaID := uuid.New()

	host := &types.Host{
		ID:          hostID,
		TenantID:    tenantID,
		CloudAreaID: &cloudAreaID,
		HostName:    "test-host",
		PrimaryIP:   "192.168.1.100",
		Status:      types.HostStatusRunning,
		IsDestroyed: false,
	}
	db.Create(host)

	t.Run("标记为已销毁", func(t *testing.T) {
		err := repo.MarkAsDestroyed(ctx, hostID)
		assert.NoError(t, err)

		// 验证状态
		var updated types.Host
		db.First(&updated, "id = ?", hostID)
		assert.True(t, updated.IsDestroyed)
	})

	t.Run("重复标记报错", func(t *testing.T) {
		err := repo.MarkAsDestroyed(ctx, hostID)
		assert.Error(t, err, "已销毁的主机不应再次标记")
	})
}

func TestHostRepository_BatchCreateHosts(t *testing.T) {
	db := setupHostTestDB(t)
	repo := NewHostRepository(db)
	ctx := context.Background()

	tenantID := uuid.New()
	cloudAreaID := uuid.New()

	hosts := []*types.Host{
		{
			HostName:    "host1",
			PrimaryIP:   "192.168.1.1",
			CloudAreaID: &cloudAreaID,
			Status:      types.HostStatusRunning,
		},
		{
			HostName:    "host2",
			PrimaryIP:   "192.168.1.2",
			CloudAreaID: &cloudAreaID,
			Status:      types.HostStatusRunning,
		},
		{
			HostName:    "host3",
			PrimaryIP:   "192.168.1.3",
			CloudAreaID: &cloudAreaID,
			Status:      types.HostStatusRunning,
		},
	}

	t.Run("批量创建成功", func(t *testing.T) {
		err := repo.BatchCreateHosts(ctx, tenantID, hosts)
		assert.NoError(t, err)

		// 验证所有主机都创建成功
		var count int64
		db.Model(&types.Host{}).Count(&count)
		assert.Equal(t, int64(3), count)

		// 验证ID和时间戳已设置
		for _, h := range hosts {
			assert.NotEqual(t, uuid.Nil, h.ID)
			assert.False(t, h.CreatedAt.IsZero())
			assert.Equal(t, tenantID, h.TenantID)
		}
	})

	t.Run("空数组不报错", func(t *testing.T) {
		err := repo.BatchCreateHosts(ctx, tenantID, []*types.Host{})
		assert.NoError(t, err)
	})
}
