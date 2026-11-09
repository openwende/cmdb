package main

import (
	"context"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/openwende/cmdb-server/internal/api/server"
	"github.com/openwende/cmdb-server/internal/core/business"
	"github.com/openwende/cmdb-server/internal/core/instance"
	"github.com/openwende/cmdb-server/internal/core/mainline"
	"github.com/openwende/cmdb-server/internal/core/model"
	"github.com/openwende/cmdb-server/internal/storage"
	"github.com/openwende/cmdb-server/pkg/config"
	"gorm.io/gorm"
)

// version flags
var (
	version   = "dev"
	commit    = "none"
	buildTime = "unknown"
)

func main() {
	// 1. Load Config
	cfg, err := config.Load("")
	if err != nil {
		log.Fatalf("Failed to load config: %v", err)
	}

	// 2. Initialize Database (Strict PostgreSQL, no AutoMigrate)
	db, err := storage.NewDatabase(&cfg.Database)
	if err != nil {
		log.Fatalf("Failed to connect to database: %v", err)
	}
	defer func() { _ = db.Close() }()

	// 表结构由 canonical 迁移(golang-migrate)创建。以下仅为开发态兼容:
	// runtime DDL 在 canonical 已建表时幂等跳过(CREATE IF NOT EXISTS);v2 资源图表当前只在此建。
	if os.Getenv("ENABLE_COMPAT_AUTOMIGRATE") == "true" {
		if err := storage.MigrateRuntimeAuthSupportTables(db.DB()); err != nil {
			log.Fatalf("Failed to run runtime auth migrations: %v", err)
		}
		if err := storage.MigrateRuntimeSupportTables(db.DB()); err != nil {
			log.Fatalf("Failed to run runtime support migrations: %v", err)
		}
		if err := storage.MigrateRuntimeProcessSupportTables(db.DB()); err != nil {
			log.Fatalf("Failed to run runtime process support migrations: %v", err)
		}
		if err := storage.MigrateRuntimeServiceCategorySupportTables(db.DB()); err != nil {
			log.Fatalf("Failed to run service category migrations: %v", err)
		}
		if err := storage.MigrateRuntimeResourceSupportTables(db.DB()); err != nil {
			log.Fatalf("Failed to run runtime resource support migrations: %v", err)
		}
		if err := storage.MigrateResourceGraphTables(db.DB()); err != nil {
			log.Fatalf("Failed to run resource graph migrations: %v", err)
		}
	}

	// 统一 seed:canonical 建表后无条件、按正确顺序配齐内置数据(单一入口,幂等)。
	// 顺序硬约束:内置模型(A 套)→ B 套同步,修掉收敛前 automigrate 早于 lazy 导致的空跑。
	mainlineService := mainline.NewService(db.DB())
	seedCtx := context.Background()
	if err := seedAccounts(db.DB(), cfg); err != nil {
		log.Fatalf("Failed to seed accounts: %v", err)
	}
	if err := storage.SeedBuiltins(db.DB()); err != nil {
		log.Fatalf("Failed to seed builtin data: %v", err)
	}
	if err := mainlineService.EnsureBuiltinModels(seedCtx); err != nil {
		log.Fatalf("Failed to seed builtin mainline models: %v", err)
	}
	if err := mainlineService.EnsureTopologySettings(seedCtx); err != nil {
		log.Fatalf("Failed to seed topology settings: %v", err)
	}
	if err := storage.SeedDynamicFromStatic(db.DB()); err != nil {
		log.Fatalf("Failed to seed dynamic-from-static data: %v", err)
	}

	// 3. Initialize Repositories & Services
	businessRepo := storage.NewBusinessRepository(db.DB())
	// For MVP, businessSetRepo and personnelRepo could just return the nil interface wrapper or be implemented
	// Since service.go expects interfaces, we can mock or implement minimal versions if not fully ported yet.
	// But based on previous exploration, storage.NewBusinessSetRepository existed.
	// Let's assume it exists or use a wrapper.
	// WARNING: We previously saw NewBusinessSetRepository in redundant code, if it used SQLite hacks we might need to check it.
	// For now, let's verify if we need to clean up business_set_repository.go too.

	// Assuming storage/business_set_repository.go exists and is compatible or needs cleanup.
	// Ideally we should have cleaned it up in the previous step if it had SQLite hacks.
	// Let's quickly create a compatible version if it's broken, but main.go needs to compile.
	// Re-using existing repo factories for now.
	businessSetRepo := storage.NewBusinessSetRepository(db.DB())

	// We need a personnel repo as per service definition
	// In the original service code (Step 202 in previous turn), it accepted personnelRepo.
	// We didn't see a NewBusinessPersonnelRepository in `internal/storage` file list earlier (Step 32 showed business_set_repository.go but no personnel one?).
	// Wait, Step 32 showed: business.go, business_set.go, database.go.
	// Ah, I might need to check if NewBusinessPersonnelRepository exists.
	// If it doesn't, we pass nil as the service handles nil repo gracefully (Step 202: `if s.personnelRepo != nil`).

	// Initialize Personnel Repository
	personnelRepo := storage.NewBusinessPersonnelRepository(db.DB())

	// Initialize Business Services
	businessService := business.NewService(db.DB(), businessRepo, businessSetRepo, personnelRepo)

	// Initialize Dynamic Engine Repositories
	modelRepo := storage.NewModelRepository(db.DB())
	instanceRepo := storage.NewInstanceRepository(db.DB())

	// Initialize Dynamic Engine Services
	modelService := model.NewService(modelRepo)
	instanceService := instance.NewService(instanceRepo, modelRepo, db.DB(), mainlineService)

	// 4. Initialize Server
	srv := server.NewServer(cfg, businessService, modelService, instanceService, db)

	// 5. Start Server with Graceful Shutdown
	go func() {
		fmt.Printf("🚀 Wende CMDB Server %s (%s) build %s\n", version, commit, buildTime)
		fmt.Printf("🌐 Server starting on %s\n", cfg.Server.GetAddress())
		if err := srv.Run(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("Failed to start server: %v", err)
		}
	}()

	// Wait for interrupt signal using a buffered channel
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit
	log.Println("Shutting down server...")

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	if err := srv.Shutdown(ctx); err != nil {
		log.Fatal("Server forced to shutdown:", err)
	}
	log.Println("Server exiting")
}

// seedAccounts creates the accounts a new database starts with. Demo accounts
// have published passwords, so release mode only creates them when asked to.
func seedAccounts(db *gorm.DB, cfg *config.Config) error {
	if cfg.Server.Mode != "release" || cfg.Auth.Bootstrap.SeedDemoUsers {
		return storage.SeedAuthUsers(db)
	}

	generatedPassword, err := storage.EnsureInitialAdmin(db, cfg.Auth.Bootstrap.AdminPassword)
	if err != nil {
		return err
	}
	if generatedPassword != "" {
		log.Printf("Created the initial admin account. Username: %s, password: %s. This password is only shown once.",
			storage.InitialAdminUsername, generatedPassword)
	}
	return nil
}
