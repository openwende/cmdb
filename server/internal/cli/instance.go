package cli

import (
	"encoding/json"
	"fmt"
	"os"
	"strings"

	"github.com/spf13/cobra"
)

// instanceCmd represents the instance command
var instanceCmd = &cobra.Command{
	Use:   "instance",
	Short: "Instance management",
	Long:  `Manage CMDB instances including creation, updates, and queries.`,
}

// instanceListCmd represents the instance list command
var instanceListCmd = &cobra.Command{
	Use:   "list <model-name>",
	Short: "List instances of a model",
	Long:  `List all instances of a specific model.`,
	Args:  cobra.ExactArgs(1),
	Run: func(cmd *cobra.Command, args []string) {
		modelName := args[0]
		page, _ := cmd.Flags().GetInt("page")
		pageSize, _ := cmd.Flags().GetInt("page-size")
		search, _ := cmd.Flags().GetString("search")
		filters, _ := cmd.Flags().GetStringSlice("filter")
		
		// Build query parameters
		params := fmt.Sprintf("?page=%d&page_size=%d", page, pageSize)
		if search != "" {
			params += "&search=" + search
		}
		
		// Add filters
		for _, filter := range filters {
			parts := strings.SplitN(filter, "=", 2)
			if len(parts) == 2 {
				params += fmt.Sprintf("&%s=%s", parts[0], parts[1])
			}
		}
		
		response, err := makeAuthenticatedAPICall("GET", "/api/v1/instances/"+modelName+params, nil)
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
			fmt.Fprintf(os.Stderr, "Failed to list instances\n")
			os.Exit(1)
		}
		
		if err := formatOutput(listResponse.Data); err != nil {
			fmt.Fprintf(os.Stderr, "Failed to format output: %v\n", err)
			os.Exit(1)
		}
	},
}

// instanceShowCmd represents the instance show command
var instanceShowCmd = &cobra.Command{
	Use:   "show <model-name> <instance-id>",
	Short: "Show instance details",
	Long:  `Show detailed information about a specific instance.`,
	Args:  cobra.ExactArgs(2),
	Run: func(cmd *cobra.Command, args []string) {
		modelName := args[0]
		instanceID := args[1]
		
		response, err := makeAuthenticatedAPICall("GET", "/api/v1/instances/"+modelName+"/"+instanceID, nil)
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
			fmt.Fprintf(os.Stderr, "Failed to get instance details\n")
			os.Exit(1)
		}
		
		if err := formatOutput(showResponse.Data); err != nil {
			fmt.Fprintf(os.Stderr, "Failed to format output: %v\n", err)
			os.Exit(1)
		}
	},
}

// instanceCreateCmd represents the instance create command
var instanceCreateCmd = &cobra.Command{
	Use:   "create <model-name>",
	Short: "Create a new instance",
	Long:  `Create a new instance of a model.`,
	Args:  cobra.ExactArgs(1),
	Run: func(cmd *cobra.Command, args []string) {
		modelName := args[0]
		data, _ := cmd.Flags().GetString("data")
		file, _ := cmd.Flags().GetString("file")
		attributes, _ := cmd.Flags().GetStringSlice("attribute")
		
		var instanceData map[string]interface{}
		
		if file != "" {
			// Read data from file
			fileData, err := os.ReadFile(file)
			if err != nil {
				fmt.Fprintf(os.Stderr, "Failed to read file: %v\n", err)
				os.Exit(1)
			}
			
			if err := json.Unmarshal(fileData, &instanceData); err != nil {
				fmt.Fprintf(os.Stderr, "Failed to parse JSON from file: %v\n", err)
				os.Exit(1)
			}
		} else if data != "" {
			// Parse data from JSON string
			if err := json.Unmarshal([]byte(data), &instanceData); err != nil {
				fmt.Fprintf(os.Stderr, "Failed to parse JSON data: %v\n", err)
				os.Exit(1)
			}
		} else {
			// Build data from attributes
			instanceData = make(map[string]interface{})
			for _, attr := range attributes {
				parts := strings.SplitN(attr, "=", 2)
				if len(parts) == 2 {
					instanceData[parts[0]] = parts[1]
				}
			}
		}
		
		if len(instanceData) == 0 {
			fmt.Fprintf(os.Stderr, "No instance data provided. Use --data, --file, or --attribute flags\n")
			os.Exit(1)
		}
		
		response, err := makeAuthenticatedAPICall("POST", "/api/v1/instances/"+modelName, instanceData)
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
			fmt.Fprintf(os.Stderr, "Failed to create instance\n")
			os.Exit(1)
		}
		
		fmt.Println("Instance created successfully!")
		if err := formatOutput(createResponse.Data); err != nil {
			fmt.Fprintf(os.Stderr, "Failed to format output: %v\n", err)
			os.Exit(1)
		}
	},
}

// instanceUpdateCmd represents the instance update command
var instanceUpdateCmd = &cobra.Command{
	Use:   "update <model-name> <instance-id>",
	Short: "Update an instance",
	Long:  `Update an existing instance.`,
	Args:  cobra.ExactArgs(2),
	Run: func(cmd *cobra.Command, args []string) {
		modelName := args[0]
		instanceID := args[1]
		data, _ := cmd.Flags().GetString("data")
		file, _ := cmd.Flags().GetString("file")
		attributes, _ := cmd.Flags().GetStringSlice("attribute")
		
		var updateData map[string]interface{}
		
		if file != "" {
			// Read data from file
			fileData, err := os.ReadFile(file)
			if err != nil {
				fmt.Fprintf(os.Stderr, "Failed to read file: %v\n", err)
				os.Exit(1)
			}
			
			if err := json.Unmarshal(fileData, &updateData); err != nil {
				fmt.Fprintf(os.Stderr, "Failed to parse JSON from file: %v\n", err)
				os.Exit(1)
			}
		} else if data != "" {
			// Parse data from JSON string
			if err := json.Unmarshal([]byte(data), &updateData); err != nil {
				fmt.Fprintf(os.Stderr, "Failed to parse JSON data: %v\n", err)
				os.Exit(1)
			}
		} else {
			// Build data from attributes
			updateData = make(map[string]interface{})
			for _, attr := range attributes {
				parts := strings.SplitN(attr, "=", 2)
				if len(parts) == 2 {
					updateData[parts[0]] = parts[1]
				}
			}
		}
		
		if len(updateData) == 0 {
			fmt.Fprintf(os.Stderr, "No update data provided. Use --data, --file, or --attribute flags\n")
			os.Exit(1)
		}
		
		response, err := makeAuthenticatedAPICall("PUT", "/api/v1/instances/"+modelName+"/"+instanceID, updateData)
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
			fmt.Fprintf(os.Stderr, "Failed to update instance\n")
			os.Exit(1)
		}
		
		fmt.Println("Instance updated successfully!")
		if err := formatOutput(updateResponse.Data); err != nil {
			fmt.Fprintf(os.Stderr, "Failed to format output: %v\n", err)
			os.Exit(1)
		}
	},
}

// instanceDeleteCmd represents the instance delete command
var instanceDeleteCmd = &cobra.Command{
	Use:   "delete <model-name> <instance-id>",
	Short: "Delete an instance",
	Long:  `Delete an instance from the CMDB.`,
	Args:  cobra.ExactArgs(2),
	Run: func(cmd *cobra.Command, args []string) {
		modelName := args[0]
		instanceID := args[1]
		force, _ := cmd.Flags().GetBool("force")
		
		if !force {
			fmt.Printf("Are you sure you want to delete instance %s? This action cannot be undone. [y/N]: ", instanceID)
			var confirmation string
			fmt.Scanln(&confirmation)
			if confirmation != "y" && confirmation != "Y" && confirmation != "yes" && confirmation != "Yes" {
				fmt.Println("Delete cancelled.")
				return
			}
		}
		
		response, err := makeAuthenticatedAPICall("DELETE", "/api/v1/instances/"+modelName+"/"+instanceID, nil)
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
			fmt.Fprintf(os.Stderr, "Failed to delete instance\n")
			os.Exit(1)
		}
		
		fmt.Printf("Instance %s deleted successfully!\n", instanceID)
	},
}

func init() {
	// Add subcommands to instance command
	instanceCmd.AddCommand(instanceListCmd)
	instanceCmd.AddCommand(instanceShowCmd)
	instanceCmd.AddCommand(instanceCreateCmd)
	instanceCmd.AddCommand(instanceUpdateCmd)
	instanceCmd.AddCommand(instanceDeleteCmd)
	
	// List command flags
	instanceListCmd.Flags().Int("page", 1, "Page number")
	instanceListCmd.Flags().Int("page-size", 20, "Page size")
	instanceListCmd.Flags().String("search", "", "Search term")
	instanceListCmd.Flags().StringSlice("filter", []string{}, "Filter by field (field=value)")
	
	// Create command flags
	instanceCreateCmd.Flags().String("data", "", "Instance data as JSON string")
	instanceCreateCmd.Flags().String("file", "", "Read instance data from JSON file")
	instanceCreateCmd.Flags().StringSlice("attribute", []string{}, "Set attribute (field=value)")
	
	// Update command flags
	instanceUpdateCmd.Flags().String("data", "", "Update data as JSON string")
	instanceUpdateCmd.Flags().String("file", "", "Read update data from JSON file")
	instanceUpdateCmd.Flags().StringSlice("attribute", []string{}, "Set attribute (field=value)")
	
	// Delete command flags
	instanceDeleteCmd.Flags().BoolP("force", "f", false, "Skip confirmation prompt")
}