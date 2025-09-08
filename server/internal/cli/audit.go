package cli

import (
	"encoding/json"
	"fmt"
	"os"

	"github.com/spf13/cobra"
)

// auditCmd represents the audit command
var auditCmd = &cobra.Command{
	Use:   "audit",
	Short: "Audit log management",
	Long:  `View and manage audit logs and security events.`,
}

// auditLogsCmd represents the audit logs command
var auditLogsCmd = &cobra.Command{
	Use:   "logs",
	Short: "View audit logs",
	Long:  `View audit logs with filtering and search capabilities.`,
	Run: func(cmd *cobra.Command, args []string) {
		page, _ := cmd.Flags().GetInt("page")
		pageSize, _ := cmd.Flags().GetInt("page-size")
		userID, _ := cmd.Flags().GetString("user-id")
		action, _ := cmd.Flags().GetString("action")
		resourceType, _ := cmd.Flags().GetString("resource-type")
		resourceID, _ := cmd.Flags().GetString("resource-id")
		success, _ := cmd.Flags().GetString("success")
		dateFrom, _ := cmd.Flags().GetString("date-from")
		dateTo, _ := cmd.Flags().GetString("date-to")
		search, _ := cmd.Flags().GetString("search")
		
		// Build query parameters
		params := fmt.Sprintf("?page=%d&page_size=%d", page, pageSize)
		if userID != "" {
			params += "&user_id=" + userID
		}
		if action != "" {
			params += "&action=" + action
		}
		if resourceType != "" {
			params += "&resource_type=" + resourceType
		}
		if resourceID != "" {
			params += "&resource_id=" + resourceID
		}
		if success != "" {
			params += "&success=" + success
		}
		if dateFrom != "" {
			params += "&date_from=" + dateFrom
		}
		if dateTo != "" {
			params += "&date_to=" + dateTo
		}
		if search != "" {
			params += "&search=" + search
		}
		
		response, err := makeAuthenticatedAPICall("GET", "/api/v1/audit/logs"+params, nil)
		if err != nil {
			handleAPIError(err)
			os.Exit(1)
		}
		
		// Parse and display response
		var logsResponse struct {
			Success bool `json:"success"`
			Data    struct {
				Items []map[string]interface{} `json:"items"`
				Pagination struct {
					Page     int `json:"page"`
					PageSize int `json:"page_size"`
					Total    int `json:"total"`
				} `json:"pagination"`
			} `json:"data"`
		}
		
		if err := json.Unmarshal(response, &logsResponse); err != nil {
			fmt.Fprintf(os.Stderr, "Failed to parse response: %v\n", err)
			os.Exit(1)
		}
		
		if !logsResponse.Success {
			fmt.Fprintf(os.Stderr, "Failed to get audit logs\n")
			os.Exit(1)
		}
		
		if err := formatOutput(logsResponse.Data); err != nil {
			fmt.Fprintf(os.Stderr, "Failed to format output: %v\n", err)
			os.Exit(1)
		}
	},
}

// auditShowCmd represents the audit show command
var auditShowCmd = &cobra.Command{
	Use:   "show <log-id>",
	Short: "Show audit log details",
	Long:  `Show detailed information about a specific audit log entry.`,
	Args:  cobra.ExactArgs(1),
	Run: func(cmd *cobra.Command, args []string) {
		logID := args[0]
		
		response, err := makeAuthenticatedAPICall("GET", "/api/v1/audit/logs/"+logID, nil)
		if err != nil {
			handleAPIError(err)
			os.Exit(1)
		}
		
		// Parse and display response
		var showResponse struct {
			Success bool                   `json:"success"`
			Data    map[string]interface{} `json:"data"`
		}
		
		if err := json.Unmarshal(response, &showResponse); err != nil {
			fmt.Fprintf(os.Stderr, "Failed to parse response: %v\n", err)
			os.Exit(1)
		}
		
		if !showResponse.Success {
			fmt.Fprintf(os.Stderr, "Failed to get audit log details\n")
			os.Exit(1)
		}
		
		if err := formatOutput(showResponse.Data); err != nil {
			fmt.Fprintf(os.Stderr, "Failed to format output: %v\n", err)
			os.Exit(1)
		}
	},
}

// auditSearchCmd represents the audit search command
var auditSearchCmd = &cobra.Command{
	Use:   "search <search-term>",
	Short: "Search audit logs",
	Long:  `Perform full-text search on audit logs.`,
	Args:  cobra.ExactArgs(1),
	Run: func(cmd *cobra.Command, args []string) {
		searchTerm := args[0]
		page, _ := cmd.Flags().GetInt("page")
		pageSize, _ := cmd.Flags().GetInt("page-size")
		
		// Build query parameters
		params := fmt.Sprintf("?q=%s&page=%d&page_size=%d", searchTerm, page, pageSize)
		
		response, err := makeAuthenticatedAPICall("GET", "/api/v1/audit/logs/search"+params, nil)
		if err != nil {
			handleAPIError(err)
			os.Exit(1)
		}
		
		// Parse and display response
		var searchResponse struct {
			Success bool `json:"success"`
			Data    struct {
				Items []map[string]interface{} `json:"items"`
				Pagination struct {
					Page     int `json:"page"`
					PageSize int `json:"page_size"`
					Total    int `json:"total"`
				} `json:"pagination"`
			} `json:"data"`
		}
		
		if err := json.Unmarshal(response, &searchResponse); err != nil {
			fmt.Fprintf(os.Stderr, "Failed to parse response: %v\n", err)
			os.Exit(1)
		}
		
		if !searchResponse.Success {
			fmt.Fprintf(os.Stderr, "Failed to search audit logs\n")
			os.Exit(1)
		}
		
		if err := formatOutput(searchResponse.Data); err != nil {
			fmt.Fprintf(os.Stderr, "Failed to format output: %v\n", err)
			os.Exit(1)
		}
	},
}

// auditExportCmd represents the audit export command
var auditExportCmd = &cobra.Command{
	Use:   "export",
	Short: "Export audit logs",
	Long:  `Export audit logs to various formats (JSON, CSV).`,
	Run: func(cmd *cobra.Command, args []string) {
		format, _ := cmd.Flags().GetString("format")
		output, _ := cmd.Flags().GetString("output")
		userID, _ := cmd.Flags().GetString("user-id")
		action, _ := cmd.Flags().GetString("action")
		resourceType, _ := cmd.Flags().GetString("resource-type")
		dateFrom, _ := cmd.Flags().GetString("date-from")
		dateTo, _ := cmd.Flags().GetString("date-to")
		
		// Build query parameters
		params := "?format=" + format
		if userID != "" {
			params += "&user_id=" + userID
		}
		if action != "" {
			params += "&action=" + action
		}
		if resourceType != "" {
			params += "&resource_type=" + resourceType
		}
		if dateFrom != "" {
			params += "&date_from=" + dateFrom
		}
		if dateTo != "" {
			params += "&date_to=" + dateTo
		}
		
		response, err := makeAuthenticatedAPICall("GET", "/api/v1/audit/logs/export"+params, nil)
		if err != nil {
			handleAPIError(err)
			os.Exit(1)
		}
		
		// Write to file or stdout
		if output != "" {
			if err := os.WriteFile(output, response, 0644); err != nil {
				fmt.Fprintf(os.Stderr, "Failed to write to file: %v\n", err)
				os.Exit(1)
			}
			fmt.Printf("Audit logs exported to %s\n", output)
		} else {
			fmt.Print(string(response))
		}
	},
}

// auditResourceCmd represents the audit resource command
var auditResourceCmd = &cobra.Command{
	Use:   "resource <resource-type> <resource-id>",
	Short: "View resource audit trail",
	Long:  `View audit trail for a specific resource.`,
	Args:  cobra.ExactArgs(2),
	Run: func(cmd *cobra.Command, args []string) {
		resourceType := args[0]
		resourceID := args[1]
		page, _ := cmd.Flags().GetInt("page")
		pageSize, _ := cmd.Flags().GetInt("page-size")
		
		// Build query parameters
		params := fmt.Sprintf("?page=%d&page_size=%d", page, pageSize)
		
		response, err := makeAuthenticatedAPICall("GET", "/api/v1/audit/resources/"+resourceType+"/"+resourceID+"/trail"+params, nil)
		if err != nil {
			handleAPIError(err)
			os.Exit(1)
		}
		
		// Parse and display response
		var trailResponse struct {
			Success bool `json:"success"`
			Data    struct {
				Items []map[string]interface{} `json:"items"`
				Pagination struct {
					Page     int `json:"page"`
					PageSize int `json:"page_size"`
					Total    int `json:"total"`
				} `json:"pagination"`
			} `json:"data"`
		}
		
		if err := json.Unmarshal(response, &trailResponse); err != nil {
			fmt.Fprintf(os.Stderr, "Failed to parse response: %v\n", err)
			os.Exit(1)
		}
		
		if !trailResponse.Success {
			fmt.Fprintf(os.Stderr, "Failed to get resource audit trail\n")
			os.Exit(1)
		}
		
		if err := formatOutput(trailResponse.Data); err != nil {
			fmt.Fprintf(os.Stderr, "Failed to format output: %v\n", err)
			os.Exit(1)
		}
	},
}

// auditUserCmd represents the audit user command
var auditUserCmd = &cobra.Command{
	Use:   "user <user-id>",
	Short: "View user activity",
	Long:  `View audit activity for a specific user.`,
	Args:  cobra.ExactArgs(1),
	Run: func(cmd *cobra.Command, args []string) {
		userID := args[0]
		page, _ := cmd.Flags().GetInt("page")
		pageSize, _ := cmd.Flags().GetInt("page-size")
		dateFrom, _ := cmd.Flags().GetString("date-from")
		dateTo, _ := cmd.Flags().GetString("date-to")
		
		// Build query parameters
		params := fmt.Sprintf("?page=%d&page_size=%d", page, pageSize)
		if dateFrom != "" {
			params += "&date_from=" + dateFrom
		}
		if dateTo != "" {
			params += "&date_to=" + dateTo
		}
		
		response, err := makeAuthenticatedAPICall("GET", "/api/v1/audit/users/"+userID+"/activity"+params, nil)
		if err != nil {
			handleAPIError(err)
			os.Exit(1)
		}
		
		// Parse and display response
		var activityResponse struct {
			Success bool `json:"success"`
			Data    struct {
				Items []map[string]interface{} `json:"items"`
				Pagination struct {
					Page     int `json:"page"`
					PageSize int `json:"page_size"`
					Total    int `json:"total"`
				} `json:"pagination"`
			} `json:"data"`
		}
		
		if err := json.Unmarshal(response, &activityResponse); err != nil {
			fmt.Fprintf(os.Stderr, "Failed to parse response: %v\n", err)
			os.Exit(1)
		}
		
		if !activityResponse.Success {
			fmt.Fprintf(os.Stderr, "Failed to get user activity\n")
			os.Exit(1)
		}
		
		if err := formatOutput(activityResponse.Data); err != nil {
			fmt.Fprintf(os.Stderr, "Failed to format output: %v\n", err)
			os.Exit(1)
		}
	},
}

// auditStatsCmd represents the audit stats command
var auditStatsCmd = &cobra.Command{
	Use:   "stats",
	Short: "View audit statistics",
	Long:  `View audit statistics and analytics.`,
	Run: func(cmd *cobra.Command, args []string) {
		dateFrom, _ := cmd.Flags().GetString("date-from")
		dateTo, _ := cmd.Flags().GetString("date-to")
		
		// Build query parameters
		params := ""
		if dateFrom != "" || dateTo != "" {
			params = "?"
			if dateFrom != "" {
				params += "date_from=" + dateFrom
			}
			if dateTo != "" {
				if dateFrom != "" {
					params += "&"
				}
				params += "date_to=" + dateTo
			}
		}
		
		response, err := makeAuthenticatedAPICall("GET", "/api/v1/audit/analytics/statistics"+params, nil)
		if err != nil {
			handleAPIError(err)
			os.Exit(1)
		}
		
		// Parse and display response
		var statsResponse struct {
			Success bool                   `json:"success"`
			Data    map[string]interface{} `json:"data"`
		}
		
		if err := json.Unmarshal(response, &statsResponse); err != nil {
			fmt.Fprintf(os.Stderr, "Failed to parse response: %v\n", err)
			os.Exit(1)
		}
		
		if !statsResponse.Success {
			fmt.Fprintf(os.Stderr, "Failed to get audit statistics\n")
			os.Exit(1)
		}
		
		if err := formatOutput(statsResponse.Data); err != nil {
			fmt.Fprintf(os.Stderr, "Failed to format output: %v\n", err)
			os.Exit(1)
		}
	},
}

// auditCleanupCmd represents the audit cleanup command
var auditCleanupCmd = &cobra.Command{
	Use:   "cleanup",
	Short: "Cleanup old audit logs",
	Long:  `Remove old audit logs based on retention policy.`,
	Run: func(cmd *cobra.Command, args []string) {
		force, _ := cmd.Flags().GetBool("force")
		
		if !force {
			fmt.Print("Are you sure you want to cleanup old audit logs? This action cannot be undone. [y/N]: ")
			var confirmation string
			fmt.Scanln(&confirmation)
			if confirmation != "y" && confirmation != "Y" && confirmation != "yes" && confirmation != "Yes" {
				fmt.Println("Cleanup cancelled.")
				return
			}
		}
		
		response, err := makeAuthenticatedAPICall("POST", "/api/v1/audit/analytics/cleanup", nil)
		if err != nil {
			handleAPIError(err)
			os.Exit(1)
		}
		
		// Parse response
		var cleanupResponse struct {
			Success bool `json:"success"`
			Data    struct {
				Message string `json:"message"`
			} `json:"data"`
		}
		
		if err := json.Unmarshal(response, &cleanupResponse); err != nil {
			fmt.Fprintf(os.Stderr, "Failed to parse response: %v\n", err)
			os.Exit(1)
		}
		
		if !cleanupResponse.Success {
			fmt.Fprintf(os.Stderr, "Failed to cleanup audit logs\n")
			os.Exit(1)
		}
		
		fmt.Println(cleanupResponse.Data.Message)
	},
}

func init() {
	// Add subcommands to audit command
	auditCmd.AddCommand(auditLogsCmd)
	auditCmd.AddCommand(auditShowCmd)
	auditCmd.AddCommand(auditSearchCmd)
	auditCmd.AddCommand(auditExportCmd)
	auditCmd.AddCommand(auditResourceCmd)
	auditCmd.AddCommand(auditUserCmd)
	auditCmd.AddCommand(auditStatsCmd)
	auditCmd.AddCommand(auditCleanupCmd)
	
	// Logs command flags
	auditLogsCmd.Flags().Int("page", 1, "Page number")
	auditLogsCmd.Flags().Int("page-size", 20, "Page size")
	auditLogsCmd.Flags().String("user-id", "", "Filter by user ID")
	auditLogsCmd.Flags().String("action", "", "Filter by action")
	auditLogsCmd.Flags().String("resource-type", "", "Filter by resource type")
	auditLogsCmd.Flags().String("resource-id", "", "Filter by resource ID")
	auditLogsCmd.Flags().String("success", "", "Filter by success status (true/false)")
	auditLogsCmd.Flags().String("date-from", "", "Filter from date (RFC3339)")
	auditLogsCmd.Flags().String("date-to", "", "Filter to date (RFC3339)")
	auditLogsCmd.Flags().String("search", "", "Search term")
	
	// Search command flags
	auditSearchCmd.Flags().Int("page", 1, "Page number")
	auditSearchCmd.Flags().Int("page-size", 20, "Page size")
	
	// Export command flags
	auditExportCmd.Flags().String("format", "json", "Export format (json, csv)")
	auditExportCmd.Flags().StringP("output", "o", "", "Output file (default: stdout)")
	auditExportCmd.Flags().String("user-id", "", "Filter by user ID")
	auditExportCmd.Flags().String("action", "", "Filter by action")
	auditExportCmd.Flags().String("resource-type", "", "Filter by resource type")
	auditExportCmd.Flags().String("date-from", "", "Filter from date (RFC3339)")
	auditExportCmd.Flags().String("date-to", "", "Filter to date (RFC3339)")
	
	// Resource command flags
	auditResourceCmd.Flags().Int("page", 1, "Page number")
	auditResourceCmd.Flags().Int("page-size", 20, "Page size")
	
	// User command flags
	auditUserCmd.Flags().Int("page", 1, "Page number")
	auditUserCmd.Flags().Int("page-size", 20, "Page size")
	auditUserCmd.Flags().String("date-from", "", "Filter from date (RFC3339)")
	auditUserCmd.Flags().String("date-to", "", "Filter to date (RFC3339)")
	
	// Stats command flags
	auditStatsCmd.Flags().String("date-from", "", "Filter from date (RFC3339)")
	auditStatsCmd.Flags().String("date-to", "", "Filter to date (RFC3339)")
	
	// Cleanup command flags
	auditCleanupCmd.Flags().BoolP("force", "f", false, "Skip confirmation prompt")
}