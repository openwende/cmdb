package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io/ioutil"
	"net/http"
)

const baseURL = "http://localhost:8080/api/v1"

func main() {
	// Wait for server? (Assume server runs separately)
	// Actually for CI/CD test we might want to start it, but local test usually implies server running.
	// We'll assume the USER runs `make dev` or `docker-compose up`.

	fmt.Println("🔍 Verify API ...")

	// 1. List Models
	fmt.Println("\n[1] Listing Models...")
	resp, err := http.Get(baseURL + "/models")
	if err != nil {
		fmt.Printf("❌ Failed to list models: %v\n", err)
		return
	}
	defer resp.Body.Close()
	body, _ := ioutil.ReadAll(resp.Body)
	fmt.Printf("Status: %s\nBody: %s\n", resp.Status, string(body))

	if resp.StatusCode != 200 {
		fmt.Println("❌ Expected 200 OK")
		// return
	}

	// 2. Create Host via API
	fmt.Println("\n[2] Creating Host Instance via API...")

	// Payload
	data := map[string]interface{}{
		"properties": map[string]interface{}{
			"inner_ip":  "10.0.0.99",
			"hostname":  "api-test-01",
			"cpu_cores": 2, // Int
		},
	}
	jsonData, _ := json.Marshal(data)

	client := &http.Client{}
	req, _ := http.NewRequest("POST", baseURL+"/models/host/instances", bytes.NewBuffer(jsonData))
	req.Header.Set("Content-Type", "application/json")
	// Header X-Tenant-ID is optional (has default fallback in handler)

	resp2, err := client.Do(req)
	if err != nil {
		fmt.Printf("❌ Failed to create instance: %v\n", err)
		return
	}
	defer resp2.Body.Close()
	body2, _ := ioutil.ReadAll(resp2.Body)
	fmt.Printf("Status: %s\nBody: %s\n", resp2.Status, string(body2))

	// 3. Search Host
	fmt.Println("\n[3] Searching Host (JSONB Filter)...")
	// Search inner_ip = 10.0.0.99
	// Query: q={"inner_ip":"10.0.0.99"}
	// encoded: %7B%22inner_ip%22%3A%2210.0.0.99%22%7D
	q := `{"inner_ip":"10.0.0.99"}`

	req3, _ := http.NewRequest("GET", baseURL+"/models/host/instances", nil)
	qParams := req3.URL.Query()
	qParams.Add("q", q)
	req3.URL.RawQuery = qParams.Encode()

	resp3, err := client.Do(req3)
	if err != nil {
		fmt.Printf("❌ Failed to search: %v\n", err)
		return
	}
	defer resp3.Body.Close()
	body3, _ := ioutil.ReadAll(resp3.Body)
	fmt.Printf("Status: %s\nBody: %s\n", resp3.Status, string(body3))

}
