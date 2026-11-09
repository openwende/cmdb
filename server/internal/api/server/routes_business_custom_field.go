package server

import (
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"

	"github.com/openwende/cmdb-server/internal/api/handlers"
	"github.com/openwende/cmdb-server/internal/core/business_custom_field"
)

func RegisterBusinessCustomFieldRoutes(router *gin.Engine, db *gorm.DB) {
	service := business_custom_field.NewService(db)
	handler := handlers.NewBusinessCustomFieldHandler(service)

	v1 := router.Group("/api/v1/businesses")
	{
		v1.GET("/:id/custom-fields", handler.ListCustomFields)
		v1.POST("/:id/custom-field-groups", handler.CreateGroup)
		v1.PUT("/:id/custom-field-groups/:group_id", handler.UpdateGroup)
		v1.DELETE("/:id/custom-field-groups/:group_id", handler.DeleteGroup)

		v1.POST("/:id/custom-fields", handler.CreateField)
		v1.PUT("/:id/custom-fields/:field_id", handler.UpdateField)
		v1.DELETE("/:id/custom-fields/:field_id", handler.DeleteField)

		v1.GET("/:id/form-schema/:object_type", handler.GetFormSchema)
	}
}
