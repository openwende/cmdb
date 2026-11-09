package main

import (
	"fmt"
	"os"

	"github.com/openwende/cmdb-server/pkg/config"
)

func main() {
	// Simulate Env vars
	os.Setenv("DATABASE_HOST", "env-host")
	os.Setenv("DATABASE_USER", "env-user")

	cfg, err := config.Load("")
	if err != nil {
		panic(err)
	}

	fmt.Printf("DB Host: %s\n", cfg.Database.Host)
	fmt.Printf("DB User: %s\n", cfg.Database.User)

	if cfg.Database.Host == "env-host" {
		fmt.Println("SUCCESS: config loaded from ENV")
	} else {
		fmt.Println("FAILURE: config NOT loaded from ENV")
	}
}
