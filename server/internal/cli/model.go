package cli

import (
	"encoding/json"
	"fmt"
	"os"

	"github.com/spf13/cobra"
)

// modelCmd represents the model command
var modelCmd = &cobra.Command{
	Use:   "model",
	Short: "Model management",
	Long:  `Manage CMDB models including creation, updates, and queries.`,
}

// modelListCmd represents the model list command
var modelListCmd = &cobra.Command{
	Use:   "list",
	Short: "List all models",
	Long:  `List all models in the CMDB.`,
	Run: func(cmd *cobra.Command, args []string) {
		page, _ := cmd.Flags().GetInt("page")
		pageSize, _ := cmd.Flags().GetInt("page-size")
		category, _ := cmd.Flags().GetString("category")
		search, _ := cmd.Flags().GetString("search")
		
		// Build query parameters
		params := fmt.Sprintf("?page=%d&page_size=%d", page, pageSize)
		if category != "" {
			params += "&category=" + category
		}
		if search != "" {
			params += "&search=" + search
		}
		
		response, err := makeAuthenticatedAPICall("GET", "/api/v1/models"+params, nil)
		if err != nil {
			handleAPIError(err)
			os.Exit(1)
		}
		
		// Parse and display response
		var listResponse struct {
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
		
		if err := json.Unmarshal(response, &listResponse); err != nil {
			fmt.Fprintf(os.Stderr, "Failed to parse response: %v\n", err)
			os.Exit(1)
		}
		
		if !listResponse.Success {
			fmt.Fprintf(os.Stderr, "Failed to list models\n")
			os.Exit(1)
		}
		
		if err := formatOutput(listResponse.Data); err != nil {
			fmt.Fprintf(os.Stderr, "Failed to format output: %v\n", err)
			os.Exit(1)
		}
	},
}

// modelShowCmd represents the model show command
var modelShowCmd = &cobra.Command{
	Use:   "show <model-id>",
	Short: "Show model details",
	Long:  `Show detailed information about a specific model.`,
	Args:  cobra.ExactArgs(1),
	Run: func(cmd *cobra.Command, args []string) {
		modelID := args[0]
		
		response, err := makeAuthenticatedAPICall("GET", "/api/v1/models/"+modelID, nil)
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
			fmt.Fprintf(os.Stderr, "Failed to get model details\n")
			os.Exit(1)
		}
		
		if err := formatOutput(showResponse.Data); err != nil {
			fmt.Fprintf(os.Stderr, "Failed to format output: %v\n", err)
			os.Exit(1)
		}
	},
}

// modelCreateCmd represents the model create command
var modelCreateCmd = &cobra.Command{
	Use:   "create",
	Short: "Create a new model",
	Long:  `Create a new model in the CMDB.`,
	Run: func(cmd *cobra.Command, args []string) {
		name, _ := cmd.Flags().GetString("name")
		displayName, _ := cmd.Flags().GetString("display-name")
		description, _ := cmd.Flags().GetString("description")
		category, _ := cmd.Flags().GetString("category")
		icon, _ := cmd.Flags().GetString("icon")
		
		if name == "" {
			fmt.Fprintf(os.Stderr, "Model name is required\n")
			os.Exit(1)
		}
		
		// Prepare model data
		modelData := map[string]interface{}{
			"name":         name,
			"display_name": displayName,
			"description":  description,
			"category":     category,
			"icon":         icon,
		}
		
		response, err := makeAuthenticatedAPICall("POST", "/api/v1/models", modelData)
		if err != nil {
			handleAPIError(err)
			os.Exit(1)
		}
		
		// Parse and display response
		var createResponse struct {
			Success bool                   `json:"success"`
			Data    map[string]interface{} `json:"data"`
		}
		
		if err := json.Unmarshal(response, &createResponse); err != nil {
			fmt.Fprintf(os.Stderr, "Failed to parse response: %v\n", err)
			os.Exit(1)
		}
		
		if !createResponse.Success {
			fmt.Fprintf(os.Stderr, "Failed to create model\n")
			os.Exit(1)
		}
		
		fmt.Println("Model created successfully!")
		if err := formatOutput(createResponse.Data); err != nil {
			fmt.Fprintf(os.Stderr, "Failed to format output: %v\n", err)
			os.Exit(1)
		}
	},
}

// modelUpdateCmd represents the model update command
var modelUpdateCmd = &cobra.Command{
	Use:   "update <model-id>",
	Short: "Update a model",
	Long:  `Update an existing model in the CMDB.`,
	Args:  cobra.ExactArgs(1),
	Run: func(cmd *cobra.Command, args []string) {
		modelID := args[0]
		
		displayName, _ := cmd.Flags().GetString("display-name")
		description, _ := cmd.Flags().GetString("description")
		category, _ := cmd.Flags().GetString("category")
		icon, _ := cmd.Flags().GetString("icon")
		
		// Prepare update data (only include non-empty values)
		updateData := make(map[string]interface{})
		if displayName != "" {
			updateData["display_name"] = displayName
		}
		if description != "" {
			updateData["description"] = description
		}
		if category != "" {
			updateData["category"] = category
		}
		if icon != "" {
			updateData["icon"] = icon
		}
		
		if len(updateData) == 0 {
			fmt.Fprintf(os.Stderr, "No update data provided\n")
			os.Exit(1)
		}
		
		response, err := makeAuthenticatedAPICall("PUT", "/api/v1/models/"+modelID, updateData)
		if err != nil {
			handleAPIError(err)
			os.Exit(1)
		}
		
		// Parse and display response
		var updateResponse struct {
			Success bool                   `json:"success"`
			Data    map[string]interface{} `json:"data"`
		}
		
		if err := json.Unmarshal(response, &updateResponse); err != nil {
			fmt.Fprintf(os.Stderr, "Failed to parse response: %v\n", err)
			os.Exit(1)
		}
		
		if !updateResponse.Success {
			fmt.Fprintf(os.Stderr, "Failed to update model\n")
			os.Exit(1)
		}
		
		fmt.Println("Model updated successfully!")
		if err := formatOutput(updateResponse.Data); err != nil {
			fmt.Fprintf(os.Stderr, "Failed to format output: %v\n", err)
			os.Exit(1)
		}
	},
}

// modelDeleteCmd represents the model delete command
var modelDeleteCmd = &cobra.Command{
	Use:   "delete <model-id>",
	Short: "Delete a model",
	Long:  `Delete a model from the CMDB.`,
	Args:  cobra.ExactArgs(1),
	Run: func(cmd *cobra.Command, args []string) {
		modelID := args[0]
		force, _ := cmd.Flags().GetBool("force")
		
		if !force {
			fmt.Printf("Are you sure you want to delete model %s? This action cannot be undone. [y/N]: ", modelID)
			var confirmation string
			fmt.Scanln(&confirmation)
			if confirmation != "y" && confirmation != "Y" && confirmation != "yes" && confirmation != "Yes" {
				fmt.Println("Delete cancelled.")
				return
			}
		}
		
		response, err := makeAuthenticatedAPICall("DELETE", "/api/v1/models/"+modelID, nil)
		if err != nil {
			handleAPIError(err)
			os.Exit(1)
		}
		
		// Parse response
		var deleteResponse struct {
			Success bool `json:"success"`
		}
		
		if err := json.Unmarshal(response, &deleteResponse); err != nil {
			fmt.Fprintf(os.Stderr, "Failed to parse response: %v\n", err)
			os.Exit(1)
		}
		
		if !deleteResponse.Success {
			fmt.Fprintf(os.Stderr, "Failed to delete model\n")
			os.Exit(1)
		}
		
		fmt.Printf("Model %s deleted successfully!\n", modelID)
	},
}

// modelFieldsCmd represents the model fields command
var modelFieldsCmd = &cobra.Command{
	Use:   "fields <model-id>",
	Short: "Manage model fields",
	Long:  `Manage fields for a specific model.`,
	Args:  cobra.ExactArgs(1),
	Run: func(cmd *cobra.Command, args []string) {
		modelID := args[0]
		
		response, err := makeAuthenticatedAPICall("GET", "/api/v1/models/"+modelID+"/fields", nil)
		if err != nil {
			handleAPIError(err)
			os.Exit(1)
		}
		
		// Parse and display response
		var fieldsResponse struct {
			Success bool                     `json:"success"`
			Data    []map[string]interface{} `json:"data"`
		}
		
		if err := json.Unmarshal(response, &fieldsResponse); err != nil {
			fmt.Fprintf(os.Stderr, "Failed to parse response: %v\n", err)
			os.Exit(1)
		}
		
		if !fieldsResponse.Success {
			fmt.Fprintf(os.Stderr, "Failed to get model fields\n")
			os.Exit(1)
		}
		
		if err := formatOutput(fieldsResponse.Data); err != nil {
			fmt.Fprintf(os.Stderr, "Failed to format output: %v\n", err)
			os.Exit(1)
		}
	},
}

func init() {
	// Add subcommands to model command
	modelCmd.AddCommand(modelListCmd)
	modelCmd.AddCommand(modelShowCmd)
	modelCmd.AddCommand(modelCreateCmd)
	modelCmd.AddCommand(modelUpdateCmd)
	modelCmd.AddCommand(modelDeleteCmd)
	modelCmd.AddCommand(modelFieldsCmd)
	
	// List command flags
	modelListCmd.Flags().Int("page", 1, "Page number")
	modelListCmd.Flags().Int("page-size", 20, "Page size")
	modelListCmd.Flags().String("category", "", "Filter by category")
	modelListCmd.Flags().String("search", "", "Search term")
	
	// Create command flags
	modelCreateCmd.Flags().StringP("name", "n", "", "Model name (required)")
	modelCreateCmd.Flags().String("display-name", "", "Display name")
	modelCreateCmd.Flags().StringP("description", "d", "", "Description")
	modelCreateCmd.Flags().StringP("category", "c", "", "Category")
	modelCreateCmd.Flags().String("icon", "", "Icon")
	
	// Update command flags
	modelUpdateCmd.Flags().String("display-name", "", "Display name")
	modelUpdateCmd.Flags().StringP("description", "d", "", "Description")
	modelUpdateCmd.Flags().StringP("category", "c", "", "Category")
	modelUpdateCmd.Flags().String("icon", "", "Icon")
	
	// Delete command flags
	modelDeleteCmd.Flags().BoolP("force", "f", false, "Skip confirmation prompt")
}