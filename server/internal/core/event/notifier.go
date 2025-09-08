package event

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"sync"
	"text/template"
	"time"

	"github.com/google/uuid"
	"go.uber.org/zap"

	"github.com/wend/cmdb-backend/pkg/types"
)

// NotificationManager manages notification channels and delivery
type NotificationManager struct {
	channels    map[string]*NotificationChannel
	deliverers  map[NotificationType]NotificationDeliverer
	store       NotificationStore
	templates   map[string]*NotificationTemplate
	rateLimiter *RateLimiter
	mu          sync.RWMutex
	logger      *zap.Logger
	ctx         context.Context
	cancel      context.CancelFunc
	wg          sync.WaitGroup
}

// NewNotificationManager creates a new notification manager
func NewNotificationManager(store NotificationStore, logger *zap.Logger) *NotificationManager {
	ctx, cancel := context.WithCancel(context.Background())
	
	return &NotificationManager{
		channels:    make(map[string]*NotificationChannel),
		deliverers:  make(map[NotificationType]NotificationDeliverer),
		store:       store,
		templates:   make(map[string]*NotificationTemplate),
		rateLimiter: NewRateLimiter(),
		logger:      logger,
		ctx:         ctx,
		cancel:      cancel,
	}
}

// Start starts the notification manager
func (nm *NotificationManager) Start() error {
	// Start background workers
	nm.wg.Add(1)
	go nm.deliveryWorker()

	nm.logger.Info("Notification manager started")
	return nil
}

// Stop stops the notification manager
func (nm *NotificationManager) Stop() error {
	nm.cancel()
	nm.wg.Wait()
	nm.logger.Info("Notification manager stopped")
	return nil
}

// RegisterDeliverer registers a notification deliverer
func (nm *NotificationManager) RegisterDeliverer(deliverer NotificationDeliverer) error {
	nm.mu.Lock()
	defer nm.mu.Unlock()

	nm.deliverers[deliverer.GetType()] = deliverer
	nm.logger.Info("Notification deliverer registered",
		zap.String("type", string(deliverer.GetType())))
	return nil
}

// AddChannel adds a notification channel
func (nm *NotificationManager) AddChannel(channel *NotificationChannel) error {
	nm.mu.Lock()
	defer nm.mu.Unlock()

	if channel.ID == "" {
		channel.ID = uuid.New().String()
	}

	channel.CreatedAt = time.Now()
	channel.UpdatedAt = time.Now()

	// Validate channel configuration
	if deliverer, exists := nm.deliverers[channel.Type]; exists {
		if err := deliverer.ValidateConfig(channel.Config); err != nil {
			return fmt.Errorf("invalid channel config: %w", err)
		}
	}

	nm.channels[channel.ID] = channel
	nm.logger.Info("Notification channel added",
		zap.String("id", channel.ID),
		zap.String("name", channel.Name),
		zap.String("type", string(channel.Type)))

	return nil
}

// RemoveChannel removes a notification channel
func (nm *NotificationManager) RemoveChannel(channelID string) error {
	nm.mu.Lock()
	defer nm.mu.Unlock()

	if _, exists := nm.channels[channelID]; !exists {
		return fmt.Errorf("channel not found: %s", channelID)
	}

	delete(nm.channels, channelID)
	nm.logger.Info("Notification channel removed", zap.String("id", channelID))
	return nil
}

// GetChannels returns all notification channels
func (nm *NotificationManager) GetChannels() []*NotificationChannel {
	nm.mu.RLock()
	defer nm.mu.RUnlock()

	channels := make([]*NotificationChannel, 0, len(nm.channels))
	for _, channel := range nm.channels {
		channels = append(channels, channel)
	}
	return channels
}

// ProcessEvent processes an event and sends appropriate notifications
func (nm *NotificationManager) ProcessEvent(event *Event) error {
	nm.mu.RLock()
	defer nm.mu.RUnlock()

	for _, channel := range nm.channels {
		if !channel.Enabled {
			continue
		}

		if nm.shouldNotify(event, channel) {
			notification, err := nm.createNotification(event, channel)
			if err != nil {
				nm.logger.Error("Failed to create notification",
					zap.String("channel_id", channel.ID),
					zap.String("event_id", event.ID),
					zap.Error(err))
				continue
			}

			// Check rate limiting
			if channel.RateLimit != nil && channel.RateLimit.Enabled {
				if !nm.rateLimiter.Allow(channel.ID, channel.RateLimit) {
					nm.logger.Warn("Notification rate limited",
						zap.String("channel_id", channel.ID),
						zap.String("event_id", event.ID))
					continue
				}
			}

			// Store notification
			if err := nm.store.Store(notification); err != nil {
				nm.logger.Error("Failed to store notification",
					zap.String("notification_id", notification.ID),
					zap.Error(err))
				continue
			}

			// Send notification asynchronously
			go nm.deliverNotification(notification)
		}
	}

	return nil
}

// shouldNotify determines if an event should trigger a notification for a channel
func (nm *NotificationManager) shouldNotify(event *Event, channel *NotificationChannel) bool {
	// Check event types
	if len(channel.EventTypes) > 0 {
		found := false
		for _, eventType := range channel.EventTypes {
			if event.Type == eventType {
				found = true
				break
			}
		}
		if !found {
			return false
		}
	}

	// Check severities
	if len(channel.Severities) > 0 {
		found := false
		for _, severity := range channel.Severities {
			if event.Severity == severity {
				found = true
				break
			}
		}
		if !found {
			return false
		}
	}

	// Check tenant
	if channel.TenantID != "" && event.TenantID != channel.TenantID {
		return false
	}

	// Check custom conditions
	for _, condition := range channel.Conditions {
		if !nm.evaluateCondition(event, &condition) {
			return false
		}
	}

	return true
}

// evaluateCondition evaluates a notification condition against an event
func (nm *NotificationManager) evaluateCondition(event *Event, condition *NotificationCondition) bool {
	value := nm.getFieldValue(event, condition.Field)
	
	switch condition.Operator {
	case "eq":
		return fmt.Sprintf("%v", value) == fmt.Sprintf("%v", condition.Value)
	case "ne":
		return fmt.Sprintf("%v", value) != fmt.Sprintf("%v", condition.Value)
	case "in":
		if values, ok := condition.Value.([]interface{}); ok {
			for _, v := range values {
				if fmt.Sprintf("%v", value) == fmt.Sprintf("%v", v) {
					return true
				}
			}
		}
		return false
	case "not_in":
		if values, ok := condition.Value.([]interface{}); ok {
			for _, v := range values {
				if fmt.Sprintf("%v", value) == fmt.Sprintf("%v", v) {
					return false
				}
			}
		}
		return true
	case "contains":
		return bytes.Contains([]byte(fmt.Sprintf("%v", value)), []byte(fmt.Sprintf("%v", condition.Value)))
	default:
		return true
	}
}

// getFieldValue extracts a field value from an event using dot notation
func (nm *NotificationManager) getFieldValue(event *Event, field string) interface{} {
	switch field {
	case "type":
		return string(event.Type)
	case "severity":
		return string(event.Severity)
	case "title":
		return event.Title
	case "description":
		return event.Description
	case "tenant_id":
		return event.TenantID
	case "user_id":
		return event.UserID
	case "resource_id":
		return event.ResourceID
	case "resource_type":
		return event.ResourceType
	case "source.type":
		if event.Source != nil {
			return event.Source.Type
		}
	case "source.id":
		if event.Source != nil {
			return event.Source.ID
		}
	case "source.name":
		if event.Source != nil {
			return event.Source.Name
		}
	default:
		// Try to get from metadata
		if event.Metadata != nil {
			if value, exists := event.Metadata[field]; exists {
				return value
			}
		}
	}
	return nil
}

// createNotification creates a notification from an event and channel
func (nm *NotificationManager) createNotification(event *Event, channel *NotificationChannel) (*Notification, error) {
	notification := &Notification{
		ID:         uuid.New().String(),
		EventID:    event.ID,
		ChannelID:  channel.ID,
		Type:       channel.Type,
		Status:     NotificationStatusPending,
		Recipients: channel.Recipients,
		MaxRetries: 3,
		CreatedAt:  time.Now(),
		UpdatedAt:  time.Now(),
	}

	// Generate subject and content
	subject, content, err := nm.generateNotificationContent(event, channel)
	if err != nil {
		return nil, fmt.Errorf("failed to generate notification content: %w", err)
	}

	notification.Subject = subject
	notification.Content = content

	// Create variables for template rendering
	notification.Variables = map[string]interface{}{
		"event":   event,
		"channel": channel,
	}

	return notification, nil
}

// generateNotificationContent generates subject and content for a notification
func (nm *NotificationManager) generateNotificationContent(event *Event, channel *NotificationChannel) (string, string, error) {
	// Default templates
	defaultSubject := "CMDB Alert: {{.event.Title}}"
	defaultContent := `Event: {{.event.Title}}
Description: {{.event.Description}}
Severity: {{.event.Severity}}
Time: {{.event.Timestamp.Format "2006-01-02 15:04:05"}}
{{if .event.Source}}Source: {{.event.Source.Name}} ({{.event.Source.Type}}){{end}}
{{if .event.ResourceType}}Resource: {{.event.ResourceType}}/{{.event.ResourceID}}{{end}}
`

	// Use custom template if available
	templateID := fmt.Sprintf("%s_%s", channel.Type, event.Type)
	notifTemplate := nm.templates[templateID]
	
	subject := defaultSubject
	content := defaultContent
	
	if notifTemplate != nil {
		subject = notifTemplate.Subject
		content = notifTemplate.Content
	}

	// Render templates
	data := map[string]interface{}{
		"event":   event,
		"channel": channel,
	}

	renderedSubject, err := nm.renderTemplate(subject, data)
	if err != nil {
		return "", "", fmt.Errorf("failed to render subject template: %w", err)
	}

	renderedContent, err := nm.renderTemplate(content, data)
	if err != nil {
		return "", "", fmt.Errorf("failed to render content template: %w", err)
	}

	return renderedSubject, renderedContent, nil
}

// renderTemplate renders a template with the given data
func (nm *NotificationManager) renderTemplate(templateStr string, data interface{}) (string, error) {
	tmpl, err := template.New("notification").Parse(templateStr)
	if err != nil {
		return "", err
	}

	var buf bytes.Buffer
	if err := tmpl.Execute(&buf, data); err != nil {
		return "", err
	}

	return buf.String(), nil
}

// deliverNotification delivers a notification using the appropriate deliverer
func (nm *NotificationManager) deliverNotification(notification *Notification) {
	nm.logger.Debug("Delivering notification",
		zap.String("id", notification.ID),
		zap.String("type", string(notification.Type)))

	// Update status to sending
	nm.store.UpdateStatus(notification.ID, NotificationStatusSending, nil)

	deliverer, exists := nm.deliverers[notification.Type]
	if !exists {
		nm.logger.Error("No deliverer for notification type",
			zap.String("type", string(notification.Type)))
		nm.store.UpdateStatus(notification.ID, NotificationStatusFailed, 
			map[string]interface{}{"error": "no deliverer available"})
		return
	}

	err := deliverer.Deliver(notification)
	if err != nil {
		nm.logger.Error("Failed to deliver notification",
			zap.String("id", notification.ID),
			zap.Error(err))

		// Update with error and check if we should retry
		notification.RetryCount++
		notification.LastError = err.Error()

		if notification.RetryCount < notification.MaxRetries {
			nm.store.UpdateStatus(notification.ID, NotificationStatusRetrying,
				map[string]interface{}{
					"error":       err.Error(),
					"retry_count": notification.RetryCount,
				})

			// Schedule retry
			go func() {
				delay := time.Duration(notification.RetryCount) * time.Minute
				time.Sleep(delay)
				nm.deliverNotification(notification)
			}()
		} else {
			nm.store.UpdateStatus(notification.ID, NotificationStatusFailed,
				map[string]interface{}{
					"error":       err.Error(),
					"retry_count": notification.RetryCount,
				})
		}
	} else {
		now := time.Now()
		notification.SentAt = &now
		nm.store.UpdateStatus(notification.ID, NotificationStatusSent,
			map[string]interface{}{"sent_at": now})

		nm.logger.Info("Notification delivered successfully",
			zap.String("id", notification.ID),
			zap.String("type", string(notification.Type)))
	}
}

// deliveryWorker is a background worker for processing notification delivery
func (nm *NotificationManager) deliveryWorker() {
	defer nm.wg.Done()
	
	ticker := time.NewTicker(30 * time.Second)
	defer ticker.Stop()

	for {
		select {
		case <-nm.ctx.Done():
			return
		case <-ticker.C:
			// Process pending notifications
			nm.processPendingNotifications()
		}
	}
}

// processPendingNotifications processes notifications that are pending delivery
func (nm *NotificationManager) processPendingNotifications() {
	filter := &NotificationFilter{
		Status: []NotificationStatus{NotificationStatusPending, NotificationStatusRetrying},
	}

	notifications, err := nm.store.List(filter)
	if err != nil {
		nm.logger.Error("Failed to get pending notifications", zap.Error(err))
		return
	}

	for _, notification := range notifications {
		// Check if enough time has passed for retry
		if notification.Status == NotificationStatusRetrying {
			delay := time.Duration(notification.RetryCount) * time.Minute
			if time.Since(notification.UpdatedAt) < delay {
				continue
			}
		}

		go nm.deliverNotification(notification)
	}
}

// AddTemplate adds a notification template
func (nm *NotificationManager) AddTemplate(template *NotificationTemplate) error {
	nm.mu.Lock()
	defer nm.mu.Unlock()

	if template.ID == "" {
		template.ID = uuid.New().String()
	}

	template.CreatedAt = time.Now()
	template.UpdatedAt = time.Now()

	nm.templates[template.ID] = template
	nm.logger.Info("Notification template added",
		zap.String("id", template.ID),
		zap.String("name", template.Name))

	return nil
}

// RateLimiter implements rate limiting for notifications
type RateLimiter struct {
	counters map[string]*RateCounter
	mu       sync.RWMutex
}

// RateCounter tracks rate limit counts for a channel
type RateCounter struct {
	Count     int
	StartTime time.Time
}

// NewRateLimiter creates a new rate limiter
func NewRateLimiter() *RateLimiter {
	return &RateLimiter{
		counters: make(map[string]*RateCounter),
	}
}

// Allow checks if a notification is allowed based on rate limits
func (rl *RateLimiter) Allow(channelID string, config *RateLimitConfig) bool {
	rl.mu.Lock()
	defer rl.mu.Unlock()

	now := time.Now()
	counter, exists := rl.counters[channelID]

	if !exists || now.Sub(counter.StartTime) >= config.Duration {
		// Reset counter
		rl.counters[channelID] = &RateCounter{
			Count:     1,
			StartTime: now,
		}
		return true
	}

	if counter.Count >= config.MaxCount {
		return false
	}

	counter.Count++
	return true
}

// EmailDeliverer delivers notifications via email
type EmailDeliverer struct {
	smtpHost     string
	smtpPort     int
	smtpUser     string
	smtpPassword string
	fromEmail    string
	logger       *zap.Logger
}

// NewEmailDeliverer creates a new email deliverer
func NewEmailDeliverer(smtpHost string, smtpPort int, smtpUser, smtpPassword, fromEmail string, logger *zap.Logger) *EmailDeliverer {
	return &EmailDeliverer{
		smtpHost:     smtpHost,
		smtpPort:     smtpPort,
		smtpUser:     smtpUser,
		smtpPassword: smtpPassword,
		fromEmail:    fromEmail,
		logger:       logger,
	}
}

// Deliver implements NotificationDeliverer
func (ed *EmailDeliverer) Deliver(notification *Notification) error {
	// In a real implementation, you would use a proper email library
	// This is a simplified version for demonstration
	ed.logger.Info("Sending email notification",
		zap.String("notification_id", notification.ID),
		zap.Strings("recipients", notification.Recipients),
		zap.String("subject", notification.Subject))

	// Simulate email sending
	time.Sleep(100 * time.Millisecond)
	return nil
}

// GetType implements NotificationDeliverer
func (ed *EmailDeliverer) GetType() NotificationType {
	return NotificationTypeEmail
}

// ValidateConfig implements NotificationDeliverer
func (ed *EmailDeliverer) ValidateConfig(config types.JSON) error {
	// Validate email-specific configuration
	return nil
}

// WebhookDeliverer delivers notifications via webhooks
type WebhookDeliverer struct {
	client *http.Client
	logger *zap.Logger
}

// NewWebhookDeliverer creates a new webhook deliverer
func NewWebhookDeliverer(logger *zap.Logger) *WebhookDeliverer {
	return &WebhookDeliverer{
		client: &http.Client{Timeout: 30 * time.Second},
		logger: logger,
	}
}

// Deliver implements NotificationDeliverer
func (wd *WebhookDeliverer) Deliver(notification *Notification) error {
	// Get webhook URL from notification metadata
	webhookURL, ok := notification.Metadata["webhook_url"].(string)
	if !ok {
		return fmt.Errorf("webhook_url not found in notification metadata")
	}

	// Prepare payload
	payload := map[string]interface{}{
		"notification_id": notification.ID,
		"event_id":        notification.EventID,
		"subject":         notification.Subject,
		"content":         notification.Content,
		"timestamp":       notification.CreatedAt,
	}

	jsonData, err := json.Marshal(payload)
	if err != nil {
		return fmt.Errorf("failed to marshal webhook payload: %w", err)
	}

	// Send HTTP POST request
	resp, err := wd.client.Post(webhookURL, "application/json", bytes.NewBuffer(jsonData))
	if err != nil {
		return fmt.Errorf("failed to send webhook: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 400 {
		return fmt.Errorf("webhook returned status code %d", resp.StatusCode)
	}

	wd.logger.Info("Webhook notification sent",
		zap.String("notification_id", notification.ID),
		zap.String("webhook_url", webhookURL),
		zap.Int("status_code", resp.StatusCode))

	return nil
}

// GetType implements NotificationDeliverer
func (wd *WebhookDeliverer) GetType() NotificationType {
	return NotificationTypeWebhook
}

// ValidateConfig implements NotificationDeliverer
func (wd *WebhookDeliverer) ValidateConfig(config types.JSON) error {
	webhookURL, ok := config["webhook_url"].(string)
	if !ok || webhookURL == "" {
		return fmt.Errorf("webhook_url is required")
	}
	return nil
}