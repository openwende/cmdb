package model

import (
	"database/sql"
	"regexp"
	"testing"

	"github.com/DATA-DOG/go-sqlmock"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"

	"github.com/wend/cmdb-backend/pkg/types"
)

func setupTestDB(t *testing.T) (*gorm.DB, sqlmock.Sqlmock) {
	mockDB, mock, err := sqlmock.New()
	require.NoError(t, err)

	dialector := postgres.New(postgres.Config{
		DSN:                  "sqlmock_db_0",
		DriverName:           "postgres",
		Conn:                 mockDB,
		PreferSimpleProtocol: true,
	})

	db, err := gorm.Open(dialector, &gorm.Config{
		Logger: logger.Default.LogMode(logger.Silent),
	})
	require.NoError(t, err)

	return db, mock
}

func TestServiceCreation(t *testing.T) {
	db, mock := setupTestDB(t)
	defer func() {
		sqlDB, _ := db.DB()
		sqlDB.Close()
	}()

	service := NewService(db)
	assert.NotNil(t, service)
	assert.Equal(t, db, service.db)

	assert.NoError(t, mock.ExpectationsWereMet())
}

func TestCreateModel(t *testing.T) {
	db, mock := setupTestDB(t)
	defer func() {
		sqlDB, _ := db.DB()
		sqlDB.Close()
	}()

	service := NewService(db)

	model := &Model{
		Name:        "Server",
		DisplayName: "Server",
		Description: "Physical or virtual server",
		Category:    "Infrastructure",
		Icon:        "server",
		Color:       "#1f77b4",
		TenantID:    "tenant-1",
		Fields: []Field{
			{
				Name:        "hostname",
				DisplayName: "Hostname",
				Type:        "string",
				Required:    true,
			},
		},
	}

	// Mock the INSERT query
	mock.ExpectBegin()
	mock.ExpectQuery(regexp.QuoteMeta(`INSERT INTO "models"`)).
		WithArgs(
			sqlmock.AnyArg(), // id
			sqlmock.AnyArg(), // created_at
			sqlmock.AnyArg(), // updated_at
			sqlmock.AnyArg(), // deleted_at
			model.Name,
			model.DisplayName,
			model.Description,
			model.Category,
			model.Icon,
			model.Color,
			sqlmock.AnyArg(), // schema
			model.TenantID,
		).
		WillReturnRows(sqlmock.NewRows([]string{"id"}).AddRow("test-id"))

	// Mock field insertion
	mock.ExpectQuery(regexp.QuoteMeta(`INSERT INTO "fields"`)).
		WithArgs(
			sqlmock.AnyArg(), // id
			sqlmock.AnyArg(), // created_at
			sqlmock.AnyArg(), // updated_at
			sqlmock.AnyArg(), // deleted_at
			"hostname",
			"Hostname",
			"string",
			true,
			false,
			sqlmock.AnyArg(), // validation_rules
			"test-id",
			sqlmock.AnyArg(), // tenant_id
		).
		WillReturnRows(sqlmock.NewRows([]string{"id"}).AddRow("field-id"))

	mock.ExpectCommit()

	result, err := service.CreateModel(model)
	require.NoError(t, err)
	assert.NotNil(t, result)
	assert.Equal(t, model.Name, result.Name)
	assert.NotEmpty(t, result.ID)

	assert.NoError(t, mock.ExpectationsWereMet())
}

func TestGetModel(t *testing.T) {
	db, mock := setupTestDB(t)
	defer func() {
		sqlDB, _ := db.DB()
		sqlDB.Close()
	}()

	service := NewService(db)

	modelID := "test-model-id"
	tenantID := "tenant-1"

	// Mock the SELECT query for model
	mock.ExpectQuery(regexp.QuoteMeta(`SELECT * FROM "models"`)).
		WithArgs(modelID, tenantID).
		WillReturnRows(
			sqlmock.NewRows([]string{"id", "name", "display_name", "description", "category", "icon", "color", "schema", "tenant_id"}).
				AddRow(modelID, "Server", "Server", "Physical server", "Infrastructure", "server", "#1f77b4", `{}`, tenantID),
		)

	// Mock the SELECT query for fields
	mock.ExpectQuery(regexp.QuoteMeta(`SELECT * FROM "fields"`)).
		WithArgs(modelID).
		WillReturnRows(
			sqlmock.NewRows([]string{"id", "name", "display_name", "type", "required", "unique", "validation_rules", "model_id", "tenant_id"}).
				AddRow("field-1", "hostname", "Hostname", "string", true, false, `{}`, modelID, tenantID),
		)

	result, err := service.GetModel(modelID, tenantID)
	require.NoError(t, err)
	assert.NotNil(t, result)
	assert.Equal(t, modelID, result.ID)
	assert.Equal(t, "Server", result.Name)
	assert.Len(t, result.Fields, 1)
	assert.Equal(t, "hostname", result.Fields[0].Name)

	assert.NoError(t, mock.ExpectationsWereMet())
}

func TestGetModelNotFound(t *testing.T) {
	db, mock := setupTestDB(t)
	defer func() {
		sqlDB, _ := db.DB()
		sqlDB.Close()
	}()

	service := NewService(db)

	modelID := "non-existent"
	tenantID := "tenant-1"

	// Mock the SELECT query returning no rows
	mock.ExpectQuery(regexp.QuoteMeta(`SELECT * FROM "models"`)).
		WithArgs(modelID, tenantID).
		WillReturnError(gorm.ErrRecordNotFound)

	result, err := service.GetModel(modelID, tenantID)
	assert.Error(t, err)
	assert.Nil(t, result)
	assert.Contains(t, err.Error(), "not found")

	assert.NoError(t, mock.ExpectationsWereMet())
}

func TestListModels(t *testing.T) {
	db, mock := setupTestDB(t)
	defer func() {
		sqlDB, _ := db.DB()
		sqlDB.Close()
	}()

	service := NewService(db)

	tenantID := "tenant-1"

	// Mock the COUNT query
	mock.ExpectQuery(regexp.QuoteMeta(`SELECT count(*) FROM "models"`)).
		WithArgs(tenantID).
		WillReturnRows(sqlmock.NewRows([]string{"count"}).AddRow(2))

	// Mock the SELECT query for models
	mock.ExpectQuery(regexp.QuoteMeta(`SELECT * FROM "models"`)).
		WithArgs(tenantID).
		WillReturnRows(
			sqlmock.NewRows([]string{"id", "name", "display_name", "description", "category", "icon", "color", "schema", "tenant_id"}).
				AddRow("model-1", "Server", "Server", "Physical server", "Infrastructure", "server", "#1f77b4", `{}`, tenantID).
				AddRow("model-2", "Application", "Application", "Software application", "Application", "app", "#ff7f0e", `{}`, tenantID),
		)

	// Mock the SELECT query for fields for each model
	mock.ExpectQuery(regexp.QuoteMeta(`SELECT * FROM "fields"`)).
		WithArgs([]string{"model-1", "model-2"}).
		WillReturnRows(
			sqlmock.NewRows([]string{"id", "name", "display_name", "type", "required", "unique", "validation_rules", "model_id", "tenant_id"}).
				AddRow("field-1", "hostname", "Hostname", "string", true, false, `{}`, "model-1", tenantID).
				AddRow("field-2", "name", "Name", "string", true, false, `{}`, "model-2", tenantID),
		)

	options := &ListOptions{
		Page:     1,
		PageSize: 10,
	}

	result, err := service.ListModels(tenantID, options)
	require.NoError(t, err)
	assert.NotNil(t, result)
	assert.Len(t, result.Models, 2)
	assert.Equal(t, int64(2), result.Total)
	assert.Equal(t, "Server", result.Models[0].Name)
	assert.Equal(t, "Application", result.Models[1].Name)

	assert.NoError(t, mock.ExpectationsWereMet())
}

func TestUpdateModel(t *testing.T) {
	db, mock := setupTestDB(t)
	defer func() {
		sqlDB, _ := db.DB()
		sqlDB.Close()
	}()

	service := NewService(db)

	modelID := "test-model-id"
	tenantID := "tenant-1"

	// Mock finding the existing model
	mock.ExpectQuery(regexp.QuoteMeta(`SELECT * FROM "models"`)).
		WithArgs(modelID, tenantID).
		WillReturnRows(
			sqlmock.NewRows([]string{"id", "name", "display_name", "description", "category", "icon", "color", "schema", "tenant_id"}).
				AddRow(modelID, "Server", "Server", "Physical server", "Infrastructure", "server", "#1f77b4", `{}`, tenantID),
		)

	// Mock fields query
	mock.ExpectQuery(regexp.QuoteMeta(`SELECT * FROM "fields"`)).
		WithArgs(modelID).
		WillReturnRows(
			sqlmock.NewRows([]string{"id", "name", "display_name", "type", "required", "unique", "validation_rules", "model_id", "tenant_id"}),
		)

	updates := &Model{
		DisplayName: "Updated Server",
		Description: "Updated description",
		Color:       "#ff0000",
	}

	// Mock the UPDATE query
	mock.ExpectBegin()
	mock.ExpectExec(regexp.QuoteMeta(`UPDATE "models"`)).
		WithArgs(
			sqlmock.AnyArg(), // updated_at
			"Updated Server",
			"Updated description", 
			"#ff0000",
			sqlmock.AnyArg(), // schema
			modelID,
			tenantID,
		).
		WillReturnResult(sqlmock.NewResult(1, 1))
	mock.ExpectCommit()

	result, err := service.UpdateModel(modelID, tenantID, updates)
	require.NoError(t, err)
	assert.NotNil(t, result)
	assert.Equal(t, "Updated Server", result.DisplayName)
	assert.Equal(t, "Updated description", result.Description)
	assert.Equal(t, "#ff0000", result.Color)

	assert.NoError(t, mock.ExpectationsWereMet())
}

func TestDeleteModel(t *testing.T) {
	db, mock := setupTestDB(t)
	defer func() {
		sqlDB, _ := db.DB()
		sqlDB.Close()
	}()

	service := NewService(db)

	modelID := "test-model-id"
	tenantID := "tenant-1"

	// Mock finding the existing model
	mock.ExpectQuery(regexp.QuoteMeta(`SELECT * FROM "models"`)).
		WithArgs(modelID, tenantID).
		WillReturnRows(
			sqlmock.NewRows([]string{"id", "name", "display_name", "description", "category", "icon", "color", "schema", "tenant_id"}).
				AddRow(modelID, "Server", "Server", "Physical server", "Infrastructure", "server", "#1f77b4", `{}`, tenantID),
		)

	// Mock the soft delete
	mock.ExpectBegin()
	mock.ExpectExec(regexp.QuoteMeta(`UPDATE "models" SET "deleted_at"=`)).
		WithArgs(sqlmock.AnyArg(), modelID, tenantID).
		WillReturnResult(sqlmock.NewResult(1, 1))
	mock.ExpectCommit()

	err := service.DeleteModel(modelID, tenantID)
	assert.NoError(t, err)

	assert.NoError(t, mock.ExpectationsWereMet())
}

func TestValidateModel(t *testing.T) {
	service := NewService(nil) // No DB needed for validation

	tests := []struct {
		name        string
		model       *Model
		expectError bool
		errorMsg    string
	}{
		{
			name: "Valid model",
			model: &Model{
				Name:        "ValidModel",
				DisplayName: "Valid Model",
				Description: "A valid model",
				Category:    "Test",
				TenantID:    "tenant-1",
			},
			expectError: false,
		},
		{
			name: "Missing name",
			model: &Model{
				DisplayName: "Model without name",
				TenantID:    "tenant-1",
			},
			expectError: true,
			errorMsg:    "name is required",
		},
		{
			name: "Missing display name",
			model: &Model{
				Name:     "ModelWithoutDisplay",
				TenantID: "tenant-1",
			},
			expectError: true,
			errorMsg:    "display name is required",
		},
		{
			name: "Missing tenant ID",
			model: &Model{
				Name:        "ModelWithoutTenant",
				DisplayName: "Model Without Tenant",
			},
			expectError: true,
			errorMsg:    "tenant ID is required",
		},
		{
			name: "Invalid name format",
			model: &Model{
				Name:        "Invalid Name With Spaces",
				DisplayName: "Invalid Name",
				TenantID:    "tenant-1",
			},
			expectError: true,
			errorMsg:    "invalid format",
		},
		{
			name: "Name too long",
			model: &Model{
				Name:        "ThisNameIsWayTooLongForTheValidationRulesAndShouldFailValidation",
				DisplayName: "Long Name",
				TenantID:    "tenant-1",
			},
			expectError: true,
			errorMsg:    "too long",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := service.ValidateModel(tt.model)
			if tt.expectError {
				assert.Error(t, err)
				if tt.errorMsg != "" {
					assert.Contains(t, err.Error(), tt.errorMsg)
				}
			} else {
				assert.NoError(t, err)
			}
		})
	}
}

func TestValidateField(t *testing.T) {
	service := NewService(nil) // No DB needed for validation

	tests := []struct {
		name        string
		field       *Field
		expectError bool
		errorMsg    string
	}{
		{
			name: "Valid field",
			field: &Field{
				Name:        "valid_field",
				DisplayName: "Valid Field",
				Type:        "string",
				Required:    true,
			},
			expectError: false,
		},
		{
			name: "Missing name",
			field: &Field{
				DisplayName: "Field without name",
				Type:        "string",
			},
			expectError: true,
			errorMsg:    "name is required",
		},
		{
			name: "Missing type",
			field: &Field{
				Name:        "field_without_type",
				DisplayName: "Field Without Type",
			},
			expectError: true,
			errorMsg:    "type is required",
		},
		{
			name: "Invalid type",
			field: &Field{
				Name:        "invalid_type_field",
				DisplayName: "Invalid Type Field",
				Type:        "invalid_type",
			},
			expectError: true,
			errorMsg:    "invalid field type",
		},
		{
			name: "Invalid validation rules",
			field: &Field{
				Name:        "invalid_validation",
				DisplayName: "Invalid Validation",
				Type:        "string",
				ValidationRules: types.JSON{
					"min_length": "not_a_number",
				},
			},
			expectError: true,
			errorMsg:    "invalid validation rule",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := service.ValidateField(tt.field)
			if tt.expectError {
				assert.Error(t, err)
				if tt.errorMsg != "" {
					assert.Contains(t, err.Error(), tt.errorMsg)
				}
			} else {
				assert.NoError(t, err)
			}
		})
	}
}

func TestSearchModels(t *testing.T) {
	db, mock := setupTestDB(t)
	defer func() {
		sqlDB, _ := db.DB()
		sqlDB.Close()
	}()

	service := NewService(db)

	tenantID := "tenant-1"
	query := "server"

	// Mock the COUNT query
	mock.ExpectQuery(regexp.QuoteMeta(`SELECT count(*) FROM "models"`)).
		WithArgs(tenantID, "%server%", "%server%", "%server%").
		WillReturnRows(sqlmock.NewRows([]string{"count"}).AddRow(1))

	// Mock the SELECT query for models
	mock.ExpectQuery(regexp.QuoteMeta(`SELECT * FROM "models"`)).
		WithArgs(tenantID, "%server%", "%server%", "%server%").
		WillReturnRows(
			sqlmock.NewRows([]string{"id", "name", "display_name", "description", "category", "icon", "color", "schema", "tenant_id"}).
				AddRow("model-1", "Server", "Server", "Physical server", "Infrastructure", "server", "#1f77b4", `{}`, tenantID),
		)

	// Mock the SELECT query for fields
	mock.ExpectQuery(regexp.QuoteMeta(`SELECT * FROM "fields"`)).
		WithArgs([]string{"model-1"}).
		WillReturnRows(
			sqlmock.NewRows([]string{"id", "name", "display_name", "type", "required", "unique", "validation_rules", "model_id", "tenant_id"}),
		)

	options := &ListOptions{
		Page:     1,
		PageSize: 10,
	}

	result, err := service.SearchModels(tenantID, query, options)
	require.NoError(t, err)
	assert.NotNil(t, result)
	assert.Len(t, result.Models, 1)
	assert.Equal(t, int64(1), result.Total)
	assert.Equal(t, "Server", result.Models[0].Name)

	assert.NoError(t, mock.ExpectationsWereMet())
}

func TestGetModelsByCategory(t *testing.T) {
	db, mock := setupTestDB(t)
	defer func() {
		sqlDB, _ := db.DB()
		sqlDB.Close()
	}()

	service := NewService(db)

	tenantID := "tenant-1"
	category := "Infrastructure"

	// Mock the SELECT query for models by category
	mock.ExpectQuery(regexp.QuoteMeta(`SELECT * FROM "models"`)).
		WithArgs(category, tenantID).
		WillReturnRows(
			sqlmock.NewRows([]string{"id", "name", "display_name", "description", "category", "icon", "color", "schema", "tenant_id"}).
				AddRow("model-1", "Server", "Server", "Physical server", "Infrastructure", "server", "#1f77b4", `{}`, tenantID).
				AddRow("model-2", "Network", "Network", "Network device", "Infrastructure", "network", "#2ca02c", `{}`, tenantID),
		)

	// Mock the SELECT query for fields
	mock.ExpectQuery(regexp.QuoteMeta(`SELECT * FROM "fields"`)).
		WithArgs([]string{"model-1", "model-2"}).
		WillReturnRows(
			sqlmock.NewRows([]string{"id", "name", "display_name", "type", "required", "unique", "validation_rules", "model_id", "tenant_id"}),
		)

	result, err := service.GetModelsByCategory(tenantID, category)
	require.NoError(t, err)
	assert.Len(t, result, 2)
	assert.Equal(t, "Server", result[0].Name)
	assert.Equal(t, "Network", result[1].Name)
	assert.Equal(t, category, result[0].Category)
	assert.Equal(t, category, result[1].Category)

	assert.NoError(t, mock.ExpectationsWereMet())
}