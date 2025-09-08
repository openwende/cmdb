package cli

import (
	"encoding/json"
	"fmt"
	"os"
	"strings"

	"github.com/spf13/cobra"
)

// queryCmd represents the query command
var queryCmd = &cobra.Command{
	Use:   "query",
	Short: "Dynamic query management",
	Long:  `Execute dynamic queries and manage saved queries.`,
}

// queryExecuteCmd represents the query execute command
var queryExecuteCmd = &cobra.Command{
	Use:   "execute",
	Short: "Execute a dynamic query",
	Long:  `Execute a dynamic query against the CMDB.`,
	Run: func(cmd *cobra.Command, args []string) {
		queryJSON, _ := cmd.Flags().GetString("query")
		file, _ := cmd.Flags().GetString("file")
		model, _ := cmd.Flags().GetString("model")
		fields, _ := cmd.Flags().GetStringSlice("field")
		conditions, _ := cmd.Flags().GetStringSlice("condition")
		joins, _ := cmd.Flags().GetStringSlice("join")
		groupBy, _ := cmd.Flags().GetStringSlice("group-by")
		orderBy, _ := cmd.Flags().GetStringSlice("order-by")
		limit, _ := cmd.Flags().GetInt("limit")
		
		var queryData map[string]interface{}
		
		if file != "" {
			// Read query from file
			fileData, err := os.ReadFile(file)
			if err != nil {
				fmt.Fprintf(os.Stderr, "Failed to read file: %v\n", err)
				os.Exit(1)
			}
			
			if err := json.Unmarshal(fileData, &queryData); err != nil {
				fmt.Fprintf(os.Stderr, "Failed to parse JSON from file: %v\n", err)
				os.Exit(1)
			}
		} else if queryJSON != "" {
			// Parse query from JSON string
			if err := json.Unmarshal([]byte(queryJSON), &queryData); err != nil {
				fmt.Fprintf(os.Stderr, "Failed to parse JSON query: %v\n", err)
				os.Exit(1)
			}
		} else {
			// Build query from command line options
			queryData = make(map[string]interface{})
			
			if model != "" {
				queryData["model"] = model
			} else {
				fmt.Fprintf(os.Stderr, "Model name is required when building query from options\n")
				os.Exit(1)
			}
			
			if len(fields) > 0 {
				queryData["fields"] = fields
			}
			
			// Parse conditions
			if len(conditions) > 0 {
				var parsedConditions []map[string]interface{}
				for _, condition := range conditions {
					parts := strings.SplitN(condition, "=", 2)
					if len(parts) == 2 {
						// Simple equality condition
						parsedConditions = append(parsedConditions, map[string]interface{}{
							"field":    parts[0],
							"operator": "eq",
							"value":    parts[1],
						})
					} else {
						// More complex condition format: field:operator:value
						parts := strings.SplitN(condition, ":", 3)
						if len(parts) == 3 {
							parsedConditions = append(parsedConditions, map[string]interface{}{
								"field":    parts[0],
								"operator": parts[1],
								"value":    parts[2],
							})
						}
					}
				}
				if len(parsedConditions) > 0 {
					queryData["conditions"] = parsedConditions
				}
			}
			
			// Parse joins
			if len(joins) > 0 {
				var parsedJoins []map[string]interface{}
				for _, join := range joins {
					parts := strings.Split(join, ":")
					if len(parts) >= 2 {
						joinData := map[string]interface{}{
							"model":      parts[0],
							"join_field": parts[1],
						}
						if len(parts) >= 3 {
							joinData["type"] = parts[2]
						}
						parsedJoins = append(parsedJoins, joinData)
					}
				}
				if len(parsedJoins) > 0 {
					queryData["joins"] = parsedJoins
				}
			}
			
			if len(groupBy) > 0 {
				queryData["group_by"] = groupBy
			}
			
			// Parse order by
			if len(orderBy) > 0 {
				var parsedOrderBy []map[string]interface{}
				for _, order := range orderBy {
					parts := strings.Split(order, ":")
					orderData := map[string]interface{}{
						"field": parts[0],
					}
					if len(parts) > 1 {
						orderData["direction"] = parts[1]
					} else {
						orderData["direction"] = "asc"
					}
					parsedOrderBy = append(parsedOrderBy, orderData)
				}
				queryData["order_by"] = parsedOrderBy
			}
			
			if limit > 0 {
				queryData["limit"] = limit
			}
		}
		
		if len(queryData) == 0 {
			fmt.Fprintf(os.Stderr, "No query data provided. Use --query, --file, or command line options\n")
			os.Exit(1)
		}
		
		response, err := makeAuthenticatedAPICall("POST", "/api/v1/queries/execute", queryData)
		if err != nil {
			handleAPIError(err)
			os.Exit(1)
		}
		
		// Parse and display response
		var executeResponse struct {
			Success bool                   `json:"success"`
			Data    map[string]interface{} `json:"data"`
		}
		
		if err := json.Unmarshal(response, &executeResponse); err != nil {
			fmt.Fprintf(os.Stderr, "Failed to parse response: %v\n", err)
			os.Exit(1)
		}
		
		if !executeResponse.Success {
			fmt.Fprintf(os.Stderr, "Failed to execute query\n")
			os.Exit(1)
		}
		
		if err := formatOutput(executeResponse.Data); err != nil {
			fmt.Fprintf(os.Stderr, "Failed to format output: %v\n", err)
			os.Exit(1)
		}
	},
}

// querySaveCmd represents the query save command
var querySaveCmd = &cobra.Command{
	Use:   "save",
	Short: "Save a query",
	Long:  `Save a query for later execution.`,
	Run: func(cmd *cobra.Command, args []string) {
		name, _ := cmd.Flags().GetString("name")
		description, _ := cmd.Flags().GetString("description")
		queryJSON, _ := cmd.Flags().GetString("query")
		file, _ := cmd.Flags().GetString("file")
		
		if name == "" {
			fmt.Fprintf(os.Stderr, "Query name is required\n")
			os.Exit(1)
		}
		
		var queryDefinition map[string]interface{}
		
		if file != "" {
			// Read query from file
			fileData, err := os.ReadFile(file)
			if err != nil {
				fmt.Fprintf(os.Stderr, "Failed to read file: %v\n", err)
				os.Exit(1)
			}
			
			if err := json.Unmarshal(fileData, &queryDefinition); err != nil {
				fmt.Fprintf(os.Stderr, "Failed to parse JSON from file: %v\n", err)
				os.Exit(1)
			}
		} else if queryJSON != "" {
			// Parse query from JSON string
			if err := json.Unmarshal([]byte(queryJSON), &queryDefinition); err != nil {
				fmt.Fprintf(os.Stderr, "Failed to parse JSON query: %v\n", err)
				os.Exit(1)
			}
		} else {
			fmt.Fprintf(os.Stderr, "Query definition is required. Use --query or --file\n")
			os.Exit(1)
		}
		
		// Prepare save data
		saveData := map[string]interface{}{
			"name":        name,
			"description": description,
			"definition":  queryDefinition,
		}
		
		response, err := makeAuthenticatedAPICall("POST", "/api/v1/queries/saved", saveData)
		if err != nil {
			handleAPIError(err)
			os.Exit(1)
		}
		
		// Parse and display response
		var saveResponse struct {
			Success bool                   `json:"success"`
			Data    map[string]interface{} `json:"data"`
		}
		
		if err := json.Unmarshal(response, &saveResponse); err != nil {
			fmt.Fprintf(os.Stderr, "Failed to parse response: %v\n", err)
			os.Exit(1)
		}
		
		if !saveResponse.Success {
			fmt.Fprintf(os.Stderr, "Failed to save query\n")
			os.Exit(1)
		}
		
		fmt.Println("Query saved successfully!")
		if err := formatOutput(saveResponse.Data); err != nil {
			fmt.Fprintf(os.Stderr, "Failed to format output: %v\n", err)
			os.Exit(1)
		}
	},
}

// queryListCmd represents the query list command
var queryListCmd = &cobra.Command{
	Use:   "list",
	Short: "List saved queries",
	Long:  `List all saved queries.`,
	Run: func(cmd *cobra.Command, args []string) {
		page, _ := cmd.Flags().GetInt("page")
		pageSize, _ := cmd.Flags().GetInt("page-size")
		search, _ := cmd.Flags().GetString("search")
		
		// Build query parameters
		params := fmt.Sprintf("?page=%d&page_size=%d", page, pageSize)
		if search != "" {
			params += "&search=" + search
		}
		
		response, err := makeAuthenticatedAPICall("GET", "/api/v1/queries/saved"+params, nil)
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
			fmt.Fprintf(os.Stderr, "Failed to list saved queries\n")
			os.Exit(1)
		}
		
		if err := formatOutput(listResponse.Data); err != nil {
			fmt.Fprintf(os.Stderr, "Failed to format output: %v\n", err)
			os.Exit(1)
		}
	},
}

// queryRunCmd represents the query run command
var queryRunCmd = &cobra.Command{
	Use:   "run <query-id>",
	Short: "Run a saved query",
	Long:  `Execute a saved query by ID.`,
	Args:  cobra.ExactArgs(1),
	Run: func(cmd *cobra.Command, args []string) {
		queryID := args[0]
		
		response, err := makeAuthenticatedAPICall("POST", "/api/v1/queries/saved/"+queryID+"/execute", nil)
		if err != nil {
			handleAPIError(err)
			os.Exit(1)
		}
		
		// Parse and display response
		var runResponse struct {
			Success bool                   `json:"success"`
			Data    map[string]interface{} `json:"data"`
		}
		
		if err := json.Unmarshal(response, &runResponse); err != nil {
			fmt.Fprintf(os.Stderr, "Failed to parse response: %v\n", err)
			os.Exit(1)
		}
		
		if !runResponse.Success {
			fmt.Fprintf(os.Stderr, "Failed to execute saved query\n")
			os.Exit(1)
		}
		
		if err := formatOutput(runResponse.Data); err != nil {
			fmt.Fprintf(os.Stderr, "Failed to format output: %v\n", err)
			os.Exit(1)
		}
	},
}

func init() {
	// Add subcommands to query command
	queryCmd.AddCommand(queryExecuteCmd)
	queryCmd.AddCommand(querySaveCmd)
	queryCmd.AddCommand(queryListCmd)
	queryCmd.AddCommand(queryRunCmd)
	
	// Execute command flags
	queryExecuteCmd.Flags().String("query", "", "Query as JSON string")
	queryExecuteCmd.Flags().String("file", "", "Read query from JSON file")
	queryExecuteCmd.Flags().StringP("model", "m", "", "Model name")
	queryExecuteCmd.Flags().StringSlice("field", []string{}, "Fields to select")
	queryExecuteCmd.Flags().StringSlice("condition", []string{}, "Conditions (field=value or field:operator:value)")
	queryExecuteCmd.Flags().StringSlice("join", []string{}, "Joins (model:join_field[:type])")
	queryExecuteCmd.Flags().StringSlice("group-by", []string{}, "Group by fields")
	queryExecuteCmd.Flags().StringSlice("order-by", []string{}, "Order by fields (field[:direction])")
	queryExecuteCmd.Flags().Int("limit", 0, "Limit results")
	
	// Save command flags
	querySaveCmd.Flags().StringP("name", "n", "", "Query name (required)")
	querySaveCmd.Flags().StringP("description", "d", "", "Query description")
	querySaveCmd.Flags().String("query", "", "Query definition as JSON string")
	querySaveCmd.Flags().String("file", "", "Read query definition from JSON file")
	
	// List command flags
	queryListCmd.Flags().Int("page", 1, "Page number")
	queryListCmd.Flags().Int("page-size", 20, "Page size")
	queryListCmd.Flags().String("search", "", "Search term")
}