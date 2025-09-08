package auth

import (
	"context"
	"encoding/json"

	"github.com/google/uuid"
	"github.com/wend/cmdb-backend/internal/storage"
	"github.com/wend/cmdb-backend/pkg/types"
	"gorm.io/gorm"
)

// Repository provides data access for authentication operations
type Repository struct {
	db *gorm.DB
}

// NewRepository creates a new auth repository
func NewRepository(db *gorm.DB) *Repository {
	return &Repository{db: db}
}

// User operations

// CreateUser creates a new user
func (r *Repository) CreateUser(ctx context.Context, user *types.User) error {
	return r.db.WithContext(ctx).Create(user).Error
}

// GetUserByID retrieves a user by ID
func (r *Repository) GetUserByID(ctx context.Context, userID string) (*types.User, error) {
	var user types.User
	err := r.db.WithContext(ctx).
		Where("id = ? AND deleted_at IS NULL", userID).
		First(&user).Error
	if err != nil {
		return nil, err
	}
	return &user, nil
}

// GetUserByUsername retrieves a user by username
func (r *Repository) GetUserByUsername(ctx context.Context, username string) (*types.User, error) {
	var user types.User
	err := r.db.WithContext(ctx).
		Where("username = ? AND deleted_at IS NULL", username).
		First(&user).Error
	if err != nil {
		return nil, err
	}
	return &user, nil
}

// GetUserByEmail retrieves a user by email
func (r *Repository) GetUserByEmail(ctx context.Context, email string) (*types.User, error) {
	var user types.User
	err := r.db.WithContext(ctx).
		Where("email = ? AND deleted_at IS NULL", email).
		First(&user).Error
	if err != nil {
		return nil, err
	}
	return &user, nil
}

// UpdateUser updates a user
func (r *Repository) UpdateUser(ctx context.Context, user *types.User) error {
	return r.db.WithContext(ctx).Save(user).Error
}

// DeleteUser deletes a user
func (r *Repository) DeleteUser(ctx context.Context, userID string) error {
	return r.db.WithContext(ctx).Delete(&types.User{}, "id = ?", userID).Error
}

// UpdateUserLastLogin updates user's last login time
func (r *Repository) UpdateUserLastLogin(ctx context.Context, userID string) error {
	return r.db.WithContext(ctx).
		Model(&types.User{}).
		Where("id = ?", userID).
		Update("last_login_at", gorm.Expr("NOW()")).Error
}

// UserExistsByUsername checks if a user exists by username
func (r *Repository) UserExistsByUsername(ctx context.Context, username string) (bool, error) {
	var count int64
	err := r.db.WithContext(ctx).
		Model(&types.User{}).
		Where("username = ? AND deleted_at IS NULL", username).
		Count(&count).Error
	return count > 0, err
}

// UserExistsByEmail checks if a user exists by email
func (r *Repository) UserExistsByEmail(ctx context.Context, email string) (bool, error) {
	var count int64
	err := r.db.WithContext(ctx).
		Model(&types.User{}).
		Where("email = ? AND deleted_at IS NULL", email).
		Count(&count).Error
	return count > 0, err
}

// ListUsers lists users with pagination
func (r *Repository) ListUsers(ctx context.Context, tenantID string, options *types.QueryOptions) ([]*types.User, *types.Pagination, error) {
	var users []*types.User
	repo := storage.NewTenantRepository(r.db, tenantID)
	pagination, err := repo.List(ctx, &users, options)
	if err != nil {
		return nil, nil, err
	}
	return users, pagination, nil
}

// Role operations

// CreateRole creates a new role
func (r *Repository) CreateRole(ctx context.Context, role *types.Role) error {
	return r.db.WithContext(ctx).Create(role).Error
}

// GetRoleByID retrieves a role by ID
func (r *Repository) GetRoleByID(ctx context.Context, roleID string) (*types.Role, error) {
	var role types.Role
	err := r.db.WithContext(ctx).
		Preload("Permissions").
		Where("id = ? AND deleted_at IS NULL", roleID).
		First(&role).Error
	if err != nil {
		return nil, err
	}
	return &role, nil
}

// UpdateRole updates a role
func (r *Repository) UpdateRole(ctx context.Context, role *types.Role) error {
	return r.db.WithContext(ctx).Save(role).Error
}

// DeleteRole deletes a role
func (r *Repository) DeleteRole(ctx context.Context, roleID string) error {
	return r.db.WithContext(ctx).Delete(&types.Role{}, "id = ?", roleID).Error
}

// RoleExistsByName checks if a role exists by name in a tenant
func (r *Repository) RoleExistsByName(ctx context.Context, tenantID, name string) (bool, error) {
	var count int64
	err := r.db.WithContext(ctx).
		Model(&types.Role{}).
		Where("tenant_id = ? AND name = ? AND deleted_at IS NULL", tenantID, name).
		Count(&count).Error
	return count > 0, err
}

// ListRoles lists roles with pagination
func (r *Repository) ListRoles(ctx context.Context, tenantID string, options *types.QueryOptions) ([]*types.Role, *types.Pagination, error) {
	var roles []*types.Role
	repo := storage.NewTenantRepository(r.db, tenantID)
	pagination, err := repo.List(ctx, &roles, options)
	if err != nil {
		return nil, nil, err
	}
	return roles, pagination, nil
}

// Permission operations

// GetPermissionByID retrieves a permission by ID
func (r *Repository) GetPermissionByID(ctx context.Context, permissionID string) (*types.Permission, error) {
	var permission types.Permission
	err := r.db.WithContext(ctx).
		Where("id = ? AND deleted_at IS NULL", permissionID).
		First(&permission).Error
	if err != nil {
		return nil, err
	}
	return &permission, nil
}

// ListPermissions lists all permissions
func (r *Repository) ListPermissions(ctx context.Context, options *types.QueryOptions) ([]*types.Permission, *types.Pagination, error) {
	var permissions []*types.Permission
	
	query := r.db.WithContext(ctx).
		Where("deleted_at IS NULL")
	
	// Apply search through filters if provided
	if options != nil && len(options.Filters) > 0 {
		for _, filter := range options.Filters {
			if filter.Field == "search" {
				searchTerm := filter.Value.(string)
				query = query.Where("name ILIKE ? OR resource ILIKE ? OR action ILIKE ?", 
					"%"+searchTerm+"%", "%"+searchTerm+"%", "%"+searchTerm+"%")
			}
		}
	}
	
	// Apply sorting
	if options != nil && len(options.Sort) > 0 {
		for _, sort := range options.Sort {
			order := "ASC"
			if sort.Order == "desc" {
				order = "DESC"
			}
			query = query.Order(sort.Field + " " + order)
		}
	} else {
		query = query.Order("resource ASC, action ASC")
	}
	
	var total int64
	if err := query.Model(&types.Permission{}).Count(&total).Error; err != nil {
		return nil, nil, err
	}
	
	// Apply pagination
	if options != nil && options.Pagination != nil {
		offset := options.Pagination.GetOffset()
		query = query.Offset(offset).Limit(options.Pagination.PageSize)
	}
	
	if err := query.Find(&permissions).Error; err != nil {
		return nil, nil, err
	}
	
	pagination := &types.Pagination{
		Page:     1,
		PageSize: 20,
		Total:    total,
	}
	if options != nil && options.Pagination != nil {
		pagination.Page = options.Pagination.Page
		pagination.PageSize = options.Pagination.PageSize
	}
	
	return permissions, pagination, nil
}

// User-Role relationship operations

// AssignUserRoles assigns roles to a user
func (r *Repository) AssignUserRoles(ctx context.Context, userID string, roleIDs []string) error {
	// First, remove existing role assignments
	if err := r.db.WithContext(ctx).
		Where("user_id = ?", userID).
		Delete(&types.UserRole{}).Error; err != nil {
		return err
	}
	
	// Then, create new role assignments
	for _, roleID := range roleIDs {
		userRole := &types.UserRole{
			UserID: uuid.MustParse(userID),
			RoleID: uuid.MustParse(roleID),
		}
		if err := r.db.WithContext(ctx).Create(userRole).Error; err != nil {
			return err
		}
	}
	
	return nil
}

// UpdateUserRoles updates user's roles
func (r *Repository) UpdateUserRoles(ctx context.Context, userID string, roleIDs []string) error {
	return r.AssignUserRoles(ctx, userID, roleIDs)
}

// GetUserRoles gets all roles for a user
func (r *Repository) GetUserRoles(ctx context.Context, userID string) ([]string, error) {
	var roles []string
	err := r.db.WithContext(ctx).
		Table("user_roles ur").
		Joins("JOIN roles r ON ur.role_id = r.id").
		Where("ur.user_id = ? AND r.deleted_at IS NULL", userID).
		Pluck("r.name", &roles).Error
	return roles, err
}

// GetUserPermissions gets all permissions for a user (through roles)
func (r *Repository) GetUserPermissions(ctx context.Context, userID string) ([]string, error) {
	var permissions []string
	err := r.db.WithContext(ctx).
		Table("user_roles ur").
		Joins("JOIN roles r ON ur.role_id = r.id").
		Joins("JOIN role_permissions rp ON r.id = rp.role_id").
		Joins("JOIN permissions p ON rp.permission_id = p.id").
		Where("ur.user_id = ? AND r.deleted_at IS NULL AND p.deleted_at IS NULL", userID).
		Distinct().
		Pluck("p.resource || ':' || p.action", &permissions).Error
	return permissions, err
}

// UserHasPermission checks if a user has a specific permission
func (r *Repository) UserHasPermission(ctx context.Context, userID, resource, action string) (bool, error) {
	var count int64
	err := r.db.WithContext(ctx).
		Table("user_roles ur").
		Joins("JOIN roles r ON ur.role_id = r.id").
		Joins("JOIN role_permissions rp ON r.id = rp.role_id").
		Joins("JOIN permissions p ON rp.permission_id = p.id").
		Where("ur.user_id = ? AND p.resource = ? AND p.action = ? AND r.deleted_at IS NULL AND p.deleted_at IS NULL", 
			userID, resource, action).
		Count(&count).Error
	return count > 0, err
}

// Role-Permission relationship operations

// AssignRolePermissions assigns permissions to a role
func (r *Repository) AssignRolePermissions(ctx context.Context, roleID string, permissionIDs []string) error {
	// First, remove existing permission assignments
	if err := r.db.WithContext(ctx).
		Where("role_id = ?", roleID).
		Delete(&types.RolePermission{}).Error; err != nil {
		return err
	}
	
	// Then, create new permission assignments
	for _, permissionID := range permissionIDs {
		rolePermission := &types.RolePermission{
			RoleID:       uuid.MustParse(roleID),
			PermissionID: uuid.MustParse(permissionID),
		}
		if err := r.db.WithContext(ctx).Create(rolePermission).Error; err != nil {
			return err
		}
	}
	
	return nil
}

// Session operations

// CreateUserSession creates a new user session
func (r *Repository) CreateUserSession(ctx context.Context, session *UserSession) error {
	// Store session data in JSONB format in a separate sessions table
	// For now, we'll implement a simple in-memory session store
	// In production, you would store this in Redis or a sessions table
	return nil // Placeholder implementation
}

// GetUserSession retrieves a user session
func (r *Repository) GetUserSession(ctx context.Context, sessionID string) (*UserSession, error) {
	// Placeholder implementation - in production use Redis or sessions table
	return &UserSession{
		SessionID: sessionID,
		IsActive:  true,
	}, nil
}

// UpdateUserSession updates a user session
func (r *Repository) UpdateUserSession(ctx context.Context, session *UserSession) error {
	// Placeholder implementation - in production use Redis or sessions table
	return nil
}

// InvalidateUserSessions invalidates all sessions for a user
func (r *Repository) InvalidateUserSessions(ctx context.Context, userID string) error {
	// Placeholder implementation - in production use Redis or sessions table
	return nil
}

// CleanupExpiredSessions removes expired sessions
func (r *Repository) CleanupExpiredSessions(ctx context.Context) error {
	// Placeholder implementation - in production use Redis or sessions table
	return nil
}

// Audit log operations

// CreateAuditLogEntry creates a new audit log entry
func (r *Repository) CreateAuditLogEntry(ctx context.Context, entry *AuditLogEntry) error {
	// Convert to the proper audit log type
	userID, err := uuid.Parse(entry.UserID)
	if err != nil {
		return err
	}
	
	tenantID, err := uuid.Parse(entry.TenantID)
	if err != nil {
		return err
	}
	
	auditLog := &types.AuditLog{
		BaseModel: types.BaseModel{
			ID:        uuid.New(),
			CreatedAt: entry.Timestamp,
			CreatedBy: userID,
		},
		TenantID:     tenantID,
		UserID:       userID,
		Action:       types.AuditActionCreate, // Map to proper action type
		ResourceType: entry.Resource,
		ResourceID:   uuid.New(), // This should be the actual resource ID
		ClientIP:     entry.IPAddress,
		UserAgent:    entry.UserAgent,
		Success:      entry.Success,
	}
	
	if entry.Error != "" {
		auditLog.ErrorMessage = entry.Error
	}
	
	if entry.Details != nil {
		if metadata, err := json.Marshal(entry.Details); err == nil {
			auditLog.Metadata = metadata
		}
	}
	
	return r.db.WithContext(ctx).Create(auditLog).Error
}

// GetAuditLogs retrieves audit logs with pagination
func (r *Repository) GetAuditLogs(ctx context.Context, options *types.QueryOptions) ([]*AuditLogEntry, *types.Pagination, error) {
	var auditLogs []*types.AuditLog
	
	query := r.db.WithContext(ctx).
		Where("deleted_at IS NULL")
	
	// Apply filters
	if options != nil && len(options.Filters) > 0 {
		for _, filter := range options.Filters {
			switch filter.Operator {
			case "eq":
				query = query.Where(filter.Field+" = ?", filter.Value)
			case "like":
				query = query.Where(filter.Field+" ILIKE ?", "%"+filter.Value.(string)+"%")
			}
		}
	}
	
	// Apply sorting
	if options != nil && len(options.Sort) > 0 {
		for _, sort := range options.Sort {
			order := "ASC"
			if sort.Order == "desc" {
				order = "DESC"
			}
			query = query.Order(sort.Field + " " + order)
		}
	} else {
		query = query.Order("created_at DESC")
	}
	
	var total int64
	if err := query.Model(&types.AuditLog{}).Count(&total).Error; err != nil {
		return nil, nil, err
	}
	
	// Apply pagination
	if options != nil && options.Pagination != nil {
		offset := options.Pagination.GetOffset()
		query = query.Offset(offset).Limit(options.Pagination.PageSize)
	}
	
	if err := query.Find(&auditLogs).Error; err != nil {
		return nil, nil, err
	}
	
	// Convert to AuditLogEntry
	var entries []*AuditLogEntry
	for _, log := range auditLogs {
		var details map[string]interface{}
		if log.Metadata != nil {
			if err := json.Unmarshal(log.Metadata, &details); err != nil {
				details = make(map[string]interface{})
			}
		}
		
		entry := &AuditLogEntry{
			ID:        log.ID.String(),
			UserID:    log.UserID.String(),
			TenantID:  log.TenantID.String(),
			Action:    string(log.Action),
			Resource:  log.ResourceType,
			Details:   details,
			IPAddress: log.ClientIP,
			UserAgent: log.UserAgent,
			Success:   log.Success,
			Error:     log.ErrorMessage,
			Timestamp: log.CreatedAt,
		}
		entries = append(entries, entry)
	}
	
	pagination := &types.Pagination{
		Page:     1,
		PageSize: 20,
		Total:    total,
	}
	if options != nil && options.Pagination != nil {
		pagination.Page = options.Pagination.Page
		pagination.PageSize = options.Pagination.PageSize
	}
	
	return entries, pagination, nil
}