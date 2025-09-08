package cli

import (
	"fmt"
	"os"
	"path/filepath"

	"github.com/spf13/cobra"
	"github.com/spf13/viper"
)

var (
	// Global flags
	cfgFile     string
	verbose     bool
	apiEndpoint string
	token       string
	tenantID    string
)

// rootCmd represents the base command when called without any subcommands
var rootCmd = &cobra.Command{
	Use:   "cmdb",
	Short: "CMDB Command Line Interface",
	Long: `A powerful command line interface for managing Configuration Management Database (CMDB).

This CLI tool provides comprehensive functionality to:
- Manage models, fields, and relationships
- Create and manipulate instances
- Query and analyze configuration data
- Manage users, roles, and permissions
- Export and import data
- Monitor system health`,
	Version: "1.0.0",
}

// Execute adds all child commands to the root command and sets flags appropriately.
// This is called by main.main(). It only needs to happen once to the rootCmd.
func Execute() error {
	return rootCmd.Execute()
}

func init() {
	cobra.OnInitialize(initConfig)

	// Global flags
	rootCmd.PersistentFlags().StringVar(&cfgFile, "config", "", "config file (default is $HOME/.cmdb.yaml)")
	rootCmd.PersistentFlags().BoolVarP(&verbose, "verbose", "v", false, "verbose output")
	rootCmd.PersistentFlags().StringVar(&apiEndpoint, "api", "", "API endpoint URL")
	rootCmd.PersistentFlags().StringVar(&token, "token", "", "authentication token")
	rootCmd.PersistentFlags().StringVar(&tenantID, "tenant", "", "tenant ID")

	// Bind flags to viper
	viper.BindPFlag("api.endpoint", rootCmd.PersistentFlags().Lookup("api"))
	viper.BindPFlag("auth.token", rootCmd.PersistentFlags().Lookup("token"))
	viper.BindPFlag("tenant.id", rootCmd.PersistentFlags().Lookup("tenant"))
	viper.BindPFlag("verbose", rootCmd.PersistentFlags().Lookup("verbose"))

	// Add subcommands
	rootCmd.AddCommand(authCmd)
	rootCmd.AddCommand(modelCmd)
	rootCmd.AddCommand(instanceCmd)
	rootCmd.AddCommand(businessCmd)
	rootCmd.AddCommand(queryCmd)
	rootCmd.AddCommand(userCmd)
	rootCmd.AddCommand(auditCmd)
	rootCmd.AddCommand(serverCmd)
	rootCmd.AddCommand(configCmd)
	rootCmd.AddCommand(completionCmd)
}

// initConfig reads in config file and ENV variables if set.
func initConfig() {
	if cfgFile != "" {
		// Use config file from the flag.
		viper.SetConfigFile(cfgFile)
	} else {
		// Find home directory.
		home, err := os.UserHomeDir()
		cobra.CheckErr(err)

		// Search config in home directory with name ".cmdb" (without extension).
		viper.AddConfigPath(home)
		viper.AddConfigPath(".")
		viper.SetConfigType("yaml")
		viper.SetConfigName(".cmdb")
	}

	// Environment variables
	viper.SetEnvPrefix("CMDB")
	viper.AutomaticEnv() // read in environment variables that match

	// If a config file is found, read it in.
	if err := viper.ReadInConfig(); err == nil && verbose {
		fmt.Fprintln(os.Stderr, "Using config file:", viper.ConfigFileUsed())
	}

	// Set default values
	setDefaults()
}

// setDefaults sets default configuration values
func setDefaults() {
	viper.SetDefault("api.endpoint", "http://localhost:8080")
	viper.SetDefault("api.timeout", "30s")
	viper.SetDefault("output.format", "table")
	viper.SetDefault("output.no_headers", false)
	viper.SetDefault("paging.size", 20)
}

// completionCmd represents the completion command
var completionCmd = &cobra.Command{
	Use:   "completion [bash|zsh|fish|powershell]",
	Short: "Generate completion script",
	Long: `To load completions:

Bash:

  $ source <(cmdb completion bash)

  # To load completions for each session, execute once:
  # Linux:
  $ cmdb completion bash > /etc/bash_completion.d/cmdb
  # macOS:
  $ cmdb completion bash > /usr/local/etc/bash_completion.d/cmdb

Zsh:

  # If shell completion is not already enabled in your environment,
  # you will need to enable it.  You can execute the following once:

  $ echo "autoload -U compinit; compinit" >> ~/.zshrc

  # To load completions for each session, execute once:
  $ cmdb completion zsh > "${fpath[1]}/_cmdb"

  # You will need to start a new shell for this setup to take effect.

fish:

  $ cmdb completion fish | source

  # To load completions for each session, execute once:
  $ cmdb completion fish > ~/.config/fish/completions/cmdb.fish

PowerShell:

  PS> cmdb completion powershell | Out-String | Invoke-Expression

  # To load completions for every new session, run:
  PS> cmdb completion powershell > cmdb.ps1
  # and source this file from your PowerShell profile.
`,
	DisableFlagsInUseLine: true,
	ValidArgs:             []string{"bash", "zsh", "fish", "powershell"},
	Args:                  cobra.ExactValidArgs(1),
	Run: func(cmd *cobra.Command, args []string) {
		switch args[0] {
		case "bash":
			cmd.Root().GenBashCompletion(os.Stdout)
		case "zsh":
			cmd.Root().GenZshCompletion(os.Stdout)
		case "fish":
			cmd.Root().GenFishCompletion(os.Stdout, true)
		case "powershell":
			cmd.Root().GenPowerShellCompletionWithDesc(os.Stdout)
		}
	},
}

// getConfigDir returns the configuration directory
func getConfigDir() string {
	home, err := os.UserHomeDir()
	if err != nil {
		return "."
	}
	return filepath.Join(home, ".cmdb")
}

// ensureConfigDir ensures the configuration directory exists
func ensureConfigDir() error {
	configDir := getConfigDir()
	return os.MkdirAll(configDir, 0755)
}