package cli

import (
	"encoding/json"
	"fmt"
	"os"

	"github.com/spf13/cobra"
)

// businessCmd represents the business command
var businessCmd = &cobra.Command{
	Use:   "business",
	Short: "Business topology management",
	Long:  `Manage business topology including trees, nodes, and relationships.`,
}

// businessListCmd represents the business list command
var businessListCmd = &cobra.Command{
	Use:   "list",
	Short: "List business trees",
	Long:  `List all business trees in the CMDB.`,
	Run: func(cmd *cobra.Command, args []string) {
		page, _ := cmd.Flags().GetInt("page")
		pageSize, _ := cmd.Flags().GetInt("page-size")
		search, _ := cmd.Flags().GetString("search")
		
		// Build query parameters
		params := fmt.Sprintf("?page=%d&page_size=%d", page, pageSize)
		if search != "" {
			params += "&search=" + search
		}
		
		response, err := makeAuthenticatedAPICall("GET", "/api/v1/business/trees"+params, nil)
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
			fmt.Fprintf(os.Stderr, "Failed to list business trees\n")
			os.Exit(1)
		}
		
		if err := formatOutput(listResponse.Data); err != nil {
			fmt.Fprintf(os.Stderr, "Failed to format output: %v\n", err)
			os.Exit(1)
		}
	},
}

// businessShowCmd represents the business show command
var businessShowCmd = &cobra.Command{
	Use:   "show <tree-id>",
	Short: "Show business tree",
	Long:  `Show detailed information about a specific business tree.`,
	Args:  cobra.ExactArgs(1),
	Run: func(cmd *cobra.Command, args []string) {
		treeID := args[0]
		depth, _ := cmd.Flags().GetInt("depth")
		
		params := ""
		if depth > 0 {
			params = fmt.Sprintf("?depth=%d", depth)
		}
		
		response, err := makeAuthenticatedAPICall("GET", "/api/v1/business/trees/"+treeID+params, nil)
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
			fmt.Fprintf(os.Stderr, "Failed to get business tree details\n")
			os.Exit(1)
		}
		
		if err := formatOutput(showResponse.Data); err != nil {
			fmt.Fprintf(os.Stderr, "Failed to format output: %v\n", err)
			os.Exit(1)
		}
	},
}

// businessCreateCmd represents the business create command
var businessCreateCmd = &cobra.Command{
	Use:   "create",
	Short: "Create a business tree",
	Long:  `Create a new business tree.`,
	Run: func(cmd *cobra.Command, args []string) {
		name, _ := cmd.Flags().GetString("name")
		description, _ := cmd.Flags().GetString("description")
		
		if name == "" {
			fmt.Fprintf(os.Stderr, "Business tree name is required\n")
			os.Exit(1)
		}
		
		// Prepare tree data
		treeData := map[string]interface{}{
			"name":        name,
			"description": description,
		}
		
		response, err := makeAuthenticatedAPICall("POST", "/api/v1/business/trees", treeData)
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
			fmt.Fprintf(os.Stderr, "Failed to create business tree\n")
			os.Exit(1)
		}
		
		fmt.Println("Business tree created successfully!")
		if err := formatOutput(createResponse.Data); err != nil {
			fmt.Fprintf(os.Stderr, "Failed to format output: %v\n", err)
			os.Exit(1)
		}
	},
}

// businessNodeCmd represents the business node command
var businessNodeCmd = &cobra.Command{
	Use:   "node",
	Short: "Business node management",
	Long:  `Manage business nodes within trees.`,
}

// businessNodeListCmd represents the business node list command
var businessNodeListCmd = &cobra.Command{
	Use:   "list <tree-id>",
	Short: "List nodes in a business tree",
	Long:  `List all nodes in a specific business tree.`,
	Args:  cobra.ExactArgs(1),
	Run: func(cmd *cobra.Command, args []string) {
		treeID := args[0]
		parentID, _ := cmd.Flags().GetString("parent-id")
		
		params := ""
		if parentID != "" {
			params = "?parent_id=" + parentID
		}
		
		response, err := makeAuthenticatedAPICall("GET", "/api/v1/business/trees/"+treeID+"/nodes"+params, nil)
		if err != nil {
			handleAPIError(err)
			os.Exit(1)
		}
		
		// Parse and display response
		var listResponse struct {
			Success bool                     `json:"success"`
			Data    []map[string]interface{} `json:"data"`
		}
		
		if err := json.Unmarshal(response, &listResponse); err != nil {
			fmt.Fprintf(os.Stderr, "Failed to parse response: %v\n", err)
			os.Exit(1)
		}
		
		if !listResponse.Success {
			fmt.Fprintf(os.Stderr, "Failed to list business nodes\n")
			os.Exit(1)
		}
		
		if err := formatOutput(listResponse.Data); err != nil {
			fmt.Fprintf(os.Stderr, "Failed to format output: %v\n", err)
			os.Exit(1)
		}
	},
}

// businessNodeCreateCmd represents the business node create command
var businessNodeCreateCmd = &cobra.Command{
	Use:   "create <tree-id>",
	Short: "Create a business node",
	Long:  `Create a new business node in a tree.`,
	Args:  cobra.ExactArgs(1),
	Run: func(cmd *cobra.Command, args []string) {
		treeID := args[0]
		name, _ := cmd.Flags().GetString("name")
		nodeType, _ := cmd.Flags().GetString("type")
		parentID, _ := cmd.Flags().GetString("parent-id")
		description, _ := cmd.Flags().GetString("description")
		
		if name == "" {
			fmt.Fprintf(os.Stderr, "Node name is required\n")
			os.Exit(1)
		}
		
		if nodeType == "" {
			fmt.Fprintf(os.Stderr, "Node type is required\n")
			os.Exit(1)
		}
		
		// Prepare node data
		nodeData := map[string]interface{}{
			"name":        name,
			"type":        nodeType,
			"description": description,
		}
		
		if parentID != "" {
			nodeData["parent_id"] = parentID
		}
		
		response, err := makeAuthenticatedAPICall("POST", "/api/v1/business/trees/"+treeID+"/nodes", nodeData)
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
			fmt.Fprintf(os.Stderr, "Failed to create business node\n")
			os.Exit(1)
		}
		
		fmt.Println("Business node created successfully!")
		if err := formatOutput(createResponse.Data); err != nil {
			fmt.Fprintf(os.Stderr, "Failed to format output: %v\n", err)
			os.Exit(1)
		}
	},
}

// businessNodeAssignCmd represents the business node assign command
var businessNodeAssignCmd = &cobra.Command{
	Use:   "assign <tree-id> <node-id>",
	Short: "Assign instances to a business node",
	Long:  `Assign model instances to a business node.`,
	Args:  cobra.ExactArgs(2),
	Run: func(cmd *cobra.Command, args []string) {
		treeID := args[0]
		nodeID := args[1]
		modelName, _ := cmd.Flags().GetString("model")
		instanceIDs, _ := cmd.Flags().GetStringSlice("instance-id")
		
		if modelName == "" {
			fmt.Fprintf(os.Stderr, "Model name is required\n")
			os.Exit(1)
		}
		
		if len(instanceIDs) == 0 {
			fmt.Fprintf(os.Stderr, "At least one instance ID is required\n")
			os.Exit(1)
		}
		
		// Prepare assignment data
		assignData := map[string]interface{}{
			"model_name":   modelName,
			"instance_ids": instanceIDs,
		}
		
		response, err := makeAuthenticatedAPICall("POST", "/api/v1/business/trees/"+treeID+"/nodes/"+nodeID+"/assign", assignData)
		if err != nil {
			handleAPIError(err)
			os.Exit(1)
		}
		
		// Parse response
		var assignResponse struct {
			Success bool `json:"success"`
		}
		
		if err := json.Unmarshal(response, &assignResponse); err != nil {
			fmt.Fprintf(os.Stderr, "Failed to parse response: %v\n", err)
			os.Exit(1)
		}
		
		if !assignResponse.Success {
			fmt.Fprintf(os.Stderr, "Failed to assign instances to business node\n")
			os.Exit(1)
		}
		
		fmt.Printf("Successfully assigned %d instances to business node\n", len(instanceIDs))
	},
}

func init() {
	// Add subcommands to business command
	businessCmd.AddCommand(businessListCmd)
	businessCmd.AddCommand(businessShowCmd)
	businessCmd.AddCommand(businessCreateCmd)
	businessCmd.AddCommand(businessNodeCmd)
	
	// Add subcommands to business node command
	businessNodeCmd.AddCommand(businessNodeListCmd)
	businessNodeCmd.AddCommand(businessNodeCreateCmd)
	businessNodeCmd.AddCommand(businessNodeAssignCmd)
	
	// List command flags
	businessListCmd.Flags().Int("page", 1, "Page number")
	businessListCmd.Flags().Int("page-size", 20, "Page size")
	businessListCmd.Flags().String("search", "", "Search term")
	
	// Show command flags
	businessShowCmd.Flags().Int("depth", 0, "Tree depth to show (0 = unlimited)")
	
	// Create command flags
	businessCreateCmd.Flags().StringP("name", "n", "", "Business tree name (required)")
	businessCreateCmd.Flags().StringP("description", "d", "", "Description")
	
	// Node list command flags
	businessNodeListCmd.Flags().String("parent-id", "", "Filter by parent node ID")
	
	// Node create command flags
	businessNodeCreateCmd.Flags().StringP("name", "n", "", "Node name (required)")
	businessNodeCreateCmd.Flags().StringP("type", "t", "", "Node type (required)")
	businessNodeCreateCmd.Flags().String("parent-id", "", "Parent node ID")
	businessNodeCreateCmd.Flags().StringP("description", "d", "", "Description")
	
	// Node assign command flags
	businessNodeAssignCmd.Flags().StringP("model", "m", "", "Model name (required)")
	businessNodeAssignCmd.Flags().StringSlice("instance-id", []string{}, "Instance IDs to assign (required)")
}