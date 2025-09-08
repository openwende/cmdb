package event

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"sync"
	"time"

	"github.com/google/uuid"
	"go.uber.org/zap"
)

// FileEventStore implements EventStore using file system
type FileEventStore struct {
	dataPath string
	mu       sync.RWMutex
	logger   *zap.Logger
}

// NewFileEventStore creates a new file-based event store
func NewFileEventStore(dataPath string, logger *zap.Logger) (*FileEventStore, error) {
	if err := os.MkdirAll(dataPath, 0755); err != nil {
		return nil, fmt.Errorf("failed to create data directory: %w", err)
	}

	return &FileEventStore{
		dataPath: dataPath,
		logger:   logger,
	}, nil
}

// Store stores an event to the file system
func (s *FileEventStore) Store(event *Event) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	if event.ID == "" {
		event.ID = uuid.New().String()
	}

	// Create tenant directory
	tenantPath := filepath.Join(s.dataPath, "events", event.TenantID)
	if err := os.MkdirAll(tenantPath, 0755); err != nil {
		return fmt.Errorf("failed to create tenant directory: %w", err)
	}

	// Create date-based subdirectory for partitioning
	dateStr := event.Timestamp.Format("2006-01-02")
	datePath := filepath.Join(tenantPath, dateStr)
	if err := os.MkdirAll(datePath, 0755); err != nil {
		return fmt.Errorf("failed to create date directory: %w", err)
	}

	// Store event as JSON file
	eventPath := filepath.Join(datePath, event.ID+".json")
	data, err := json.MarshalIndent(event, "", "  ")
	if err != nil {
		return fmt.Errorf("failed to marshal event: %w", err)
	}

	if err := os.WriteFile(eventPath, data, 0644); err != nil {
		return fmt.Errorf("failed to write event file: %w", err)
	}

	s.logger.Debug("Event stored",
		zap.String("id", event.ID),
		zap.String("path", eventPath))

	return nil
}

// Get retrieves an event by ID
func (s *FileEventStore) Get(id string) (*Event, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	// Search across all tenant directories and dates
	eventsPath := filepath.Join(s.dataPath, "events")
	var eventPath string

	err := filepath.Walk(eventsPath, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return err
		}

		if info.IsDir() {
			return nil
		}

		if filepath.Base(path) == id+".json" {
			eventPath = path
			return filepath.SkipDir
		}

		return nil
	})

	if err != nil {
		return nil, fmt.Errorf("failed to search for event: %w", err)
	}

	if eventPath == "" {
		return nil, fmt.Errorf("event not found: %s", id)
	}

	data, err := os.ReadFile(eventPath)
	if err != nil {
		return nil, fmt.Errorf("failed to read event file: %w", err)
	}

	var event Event
	if err := json.Unmarshal(data, &event); err != nil {
		return nil, fmt.Errorf("failed to unmarshal event: %w", err)
	}

	return &event, nil
}

// List retrieves events matching the filter
func (s *FileEventStore) List(filter *EventFilter) ([]*Event, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	var events []*Event
	eventsPath := filepath.Join(s.dataPath, "events")

	// If tenant ID is specified, only search in that tenant's directory
	searchPaths := []string{eventsPath}
	if filter != nil && filter.TenantID != "" {
		searchPaths = []string{filepath.Join(eventsPath, filter.TenantID)}
	}

	for _, searchPath := range searchPaths {
		if _, err := os.Stat(searchPath); os.IsNotExist(err) {
			continue
		}

		err := filepath.Walk(searchPath, func(path string, info os.FileInfo, err error) error {
			if err != nil {
				return err
			}

			if info.IsDir() || !isEventFile(path) {
				return nil
			}

			event, err := s.loadEventFromFile(path)
			if err != nil {
				s.logger.Warn("Failed to load event",
					zap.String("path", path),
					zap.Error(err))
				return nil
			}

			if s.matchesFilter(event, filter) {
				events = append(events, event)
			}

			return nil
		})

		if err != nil {
			return nil, fmt.Errorf("failed to walk events directory: %w", err)
		}
	}

	// Sort events by timestamp (newest first)
	sort.Slice(events, func(i, j int) bool {
		return events[i].Timestamp.After(events[j].Timestamp)
	})

	return events, nil
}

// Delete removes an event by ID
func (s *FileEventStore) Delete(id string) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	// Find and delete the event file
	eventsPath := filepath.Join(s.dataPath, "events")
	var eventPath string

	err := filepath.Walk(eventsPath, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return err
		}

		if info.IsDir() {
			return nil
		}

		if filepath.Base(path) == id+".json" {
			eventPath = path
			return filepath.SkipDir
		}

		return nil
	})

	if err != nil {
		return fmt.Errorf("failed to search for event: %w", err)
	}

	if eventPath == "" {
		return fmt.Errorf("event not found: %s", id)
	}

	if err := os.Remove(eventPath); err != nil {
		return fmt.Errorf("failed to delete event file: %w", err)
	}

	s.logger.Debug("Event deleted",
		zap.String("id", id),
		zap.String("path", eventPath))

	return nil
}

// Cleanup removes events older than the specified time
func (s *FileEventStore) Cleanup(before time.Time) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	eventsPath := filepath.Join(s.dataPath, "events")
	deletedCount := 0

	err := filepath.Walk(eventsPath, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return err
		}

		if info.IsDir() || !isEventFile(path) {
			return nil
		}

		event, err := s.loadEventFromFile(path)
		if err != nil {
			s.logger.Warn("Failed to load event during cleanup",
				zap.String("path", path),
				zap.Error(err))
			return nil
		}

		if event.Timestamp.Before(before) {
			if err := os.Remove(path); err != nil {
				s.logger.Error("Failed to delete old event",
					zap.String("path", path),
					zap.Error(err))
			} else {
				deletedCount++
			}
		}

		return nil
	})

	if err != nil {
		return fmt.Errorf("failed to cleanup events: %w", err)
	}

	s.logger.Info("Event cleanup completed",
		zap.Int("deleted_count", deletedCount),
		zap.Time("before", before))

	return nil
}

// loadEventFromFile loads an event from a JSON file
func (s *FileEventStore) loadEventFromFile(path string) (*Event, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return nil, err
	}

	var event Event
	if err := json.Unmarshal(data, &event); err != nil {
		return nil, err
	}

	return &event, nil
}

// matchesFilter checks if an event matches the given filter
func (s *FileEventStore) matchesFilter(event *Event, filter *EventFilter) bool {
	if filter == nil {
		return true
	}

	// Check event types
	if len(filter.Types) > 0 {
		found := false
		for _, t := range filter.Types {
			if event.Type == t {
				found = true
				break
			}
		}
		if !found {
			return false
		}
	}

	// Check severities
	if len(filter.Severities) > 0 {
		found := false
		for _, s := range filter.Severities {
			if event.Severity == s {
				found = true
				break
			}
		}
		if !found {
			return false
		}
	}

	// Check tenant ID
	if filter.TenantID != "" && event.TenantID != filter.TenantID {
		return false
	}

	// Check user ID
	if filter.UserID != "" && event.UserID != filter.UserID {
		return false
	}

	// Check resource type
	if filter.ResourceType != "" && event.ResourceType != filter.ResourceType {
		return false
	}

	// Check resource ID
	if filter.ResourceID != "" && event.ResourceID != filter.ResourceID {
		return false
	}

	// Check time range
	if filter.StartTime != nil && event.Timestamp.Before(*filter.StartTime) {
		return false
	}
	if filter.EndTime != nil && event.Timestamp.After(*filter.EndTime) {
		return false
	}

	// Check tags
	if len(filter.Tags) > 0 {
		eventTags := make(map[string]bool)
		for _, tag := range event.Tags {
			eventTags[tag] = true
		}

		for _, tag := range filter.Tags {
			if !eventTags[tag] {
				return false
			}
		}
	}

	// Check sources
	if len(filter.Sources) > 0 && event.Source != nil {
		found := false
		for _, source := range filter.Sources {
			if event.Source.ID == source {
				found = true
				break
			}
		}
		if !found {
			return false
		}
	}

	// Check metadata filters
	if len(filter.Metadata) > 0 && event.Metadata != nil {
		for key, value := range filter.Metadata {
			if metaValue, exists := event.Metadata[key]; !exists || fmt.Sprintf("%v", metaValue) != value {
				return false
			}
		}
	}

	return true
}

// isEventFile checks if a file is an event JSON file
func isEventFile(path string) bool {
	return filepath.Ext(path) == ".json"
}

// FileNotificationStore implements NotificationStore using file system
type FileNotificationStore struct {
	dataPath string
	mu       sync.RWMutex
	logger   *zap.Logger
}

// NewFileNotificationStore creates a new file-based notification store
func NewFileNotificationStore(dataPath string, logger *zap.Logger) (*FileNotificationStore, error) {
	if err := os.MkdirAll(dataPath, 0755); err != nil {
		return nil, fmt.Errorf("failed to create data directory: %w", err)
	}

	return &FileNotificationStore{
		dataPath: dataPath,
		logger:   logger,
	}, nil
}

// Store stores a notification to the file system
func (s *FileNotificationStore) Store(notification *Notification) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	if notification.ID == "" {
		notification.ID = uuid.New().String()
	}

	// Create notifications directory
	notifPath := filepath.Join(s.dataPath, "notifications")
	if err := os.MkdirAll(notifPath, 0755); err != nil {
		return fmt.Errorf("failed to create notifications directory: %w", err)
	}

	// Create date-based subdirectory
	dateStr := notification.CreatedAt.Format("2006-01-02")
	datePath := filepath.Join(notifPath, dateStr)
	if err := os.MkdirAll(datePath, 0755); err != nil {
		return fmt.Errorf("failed to create date directory: %w", err)
	}

	// Store notification as JSON file
	notificationPath := filepath.Join(datePath, notification.ID+".json")
	data, err := json.MarshalIndent(notification, "", "  ")
	if err != nil {
		return fmt.Errorf("failed to marshal notification: %w", err)
	}

	if err := os.WriteFile(notificationPath, data, 0644); err != nil {
		return fmt.Errorf("failed to write notification file: %w", err)
	}

	return nil
}

// Get retrieves a notification by ID
func (s *FileNotificationStore) Get(id string) (*Notification, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	notifPath := filepath.Join(s.dataPath, "notifications")
	var notificationPath string

	err := filepath.Walk(notifPath, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return err
		}

		if info.IsDir() {
			return nil
		}

		if filepath.Base(path) == id+".json" {
			notificationPath = path
			return filepath.SkipDir
		}

		return nil
	})

	if err != nil {
		return nil, fmt.Errorf("failed to search for notification: %w", err)
	}

	if notificationPath == "" {
		return nil, fmt.Errorf("notification not found: %s", id)
	}

	data, err := os.ReadFile(notificationPath)
	if err != nil {
		return nil, fmt.Errorf("failed to read notification file: %w", err)
	}

	var notification Notification
	if err := json.Unmarshal(data, &notification); err != nil {
		return nil, fmt.Errorf("failed to unmarshal notification: %w", err)
	}

	return &notification, nil
}

// GetByEventID retrieves all notifications for an event
func (s *FileNotificationStore) GetByEventID(eventID string) ([]*Notification, error) {
	filter := &NotificationFilter{EventID: eventID}
	return s.List(filter)
}

// List retrieves notifications matching the filter
func (s *FileNotificationStore) List(filter *NotificationFilter) ([]*Notification, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	var notifications []*Notification
	notifPath := filepath.Join(s.dataPath, "notifications")

	if _, err := os.Stat(notifPath); os.IsNotExist(err) {
		return notifications, nil
	}

	err := filepath.Walk(notifPath, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return err
		}

		if info.IsDir() || filepath.Ext(path) != ".json" {
			return nil
		}

		notification, err := s.loadNotificationFromFile(path)
		if err != nil {
			s.logger.Warn("Failed to load notification",
				zap.String("path", path),
				zap.Error(err))
			return nil
		}

		if s.matchesNotificationFilter(notification, filter) {
			notifications = append(notifications, notification)
		}

		return nil
	})

	if err != nil {
		return nil, fmt.Errorf("failed to walk notifications directory: %w", err)
	}

	// Sort notifications by creation time (newest first)
	sort.Slice(notifications, func(i, j int) bool {
		return notifications[i].CreatedAt.After(notifications[j].CreatedAt)
	})

	return notifications, nil
}

// UpdateStatus updates the status of a notification
func (s *FileNotificationStore) UpdateStatus(id string, status NotificationStatus, metadata map[string]interface{}) error {
	notification, err := s.Get(id)
	if err != nil {
		return err
	}

	notification.Status = status
	notification.UpdatedAt = time.Now()

	if metadata != nil {
		if notification.Metadata == nil {
			notification.Metadata = make(map[string]interface{})
		}
		for k, v := range metadata {
			notification.Metadata[k] = v
		}
	}

	return s.Store(notification)
}

// Delete removes a notification by ID
func (s *FileNotificationStore) Delete(id string) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	notifPath := filepath.Join(s.dataPath, "notifications")
	var notificationPath string

	err := filepath.Walk(notifPath, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return err
		}

		if info.IsDir() {
			return nil
		}

		if filepath.Base(path) == id+".json" {
			notificationPath = path
			return filepath.SkipDir
		}

		return nil
	})

	if err != nil {
		return fmt.Errorf("failed to search for notification: %w", err)
	}

	if notificationPath == "" {
		return fmt.Errorf("notification not found: %s", id)
	}

	if err := os.Remove(notificationPath); err != nil {
		return fmt.Errorf("failed to delete notification file: %w", err)
	}

	return nil
}

// Cleanup removes notifications older than the specified time
func (s *FileNotificationStore) Cleanup(before time.Time) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	notifPath := filepath.Join(s.dataPath, "notifications")
	deletedCount := 0

	err := filepath.Walk(notifPath, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return err
		}

		if info.IsDir() || filepath.Ext(path) != ".json" {
			return nil
		}

		notification, err := s.loadNotificationFromFile(path)
		if err != nil {
			s.logger.Warn("Failed to load notification during cleanup",
				zap.String("path", path),
				zap.Error(err))
			return nil
		}

		if notification.CreatedAt.Before(before) {
			if err := os.Remove(path); err != nil {
				s.logger.Error("Failed to delete old notification",
					zap.String("path", path),
					zap.Error(err))
			} else {
				deletedCount++
			}
		}

		return nil
	})

	if err != nil {
		return fmt.Errorf("failed to cleanup notifications: %w", err)
	}

	s.logger.Info("Notification cleanup completed",
		zap.Int("deleted_count", deletedCount),
		zap.Time("before", before))

	return nil
}

// loadNotificationFromFile loads a notification from a JSON file
func (s *FileNotificationStore) loadNotificationFromFile(path string) (*Notification, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return nil, err
	}

	var notification Notification
	if err := json.Unmarshal(data, &notification); err != nil {
		return nil, err
	}

	return &notification, nil
}

// matchesNotificationFilter checks if a notification matches the given filter
func (s *FileNotificationStore) matchesNotificationFilter(notification *Notification, filter *NotificationFilter) bool {
	if filter == nil {
		return true
	}

	if filter.EventID != "" && notification.EventID != filter.EventID {
		return false
	}

	if filter.ChannelID != "" && notification.ChannelID != filter.ChannelID {
		return false
	}

	if filter.Type != "" && notification.Type != filter.Type {
		return false
	}

	if len(filter.Status) > 0 {
		found := false
		for _, status := range filter.Status {
			if notification.Status == status {
				found = true
				break
			}
		}
		if !found {
			return false
		}
	}

	if filter.StartTime != nil && notification.CreatedAt.Before(*filter.StartTime) {
		return false
	}

	if filter.EndTime != nil && notification.CreatedAt.After(*filter.EndTime) {
		return false
	}

	return true
}