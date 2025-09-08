package event

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"sync"
	"time"

	"github.com/gorilla/websocket"
	"go.uber.org/zap"
)

// WebSocketConnection represents a WebSocket connection
type WebSocketConnection struct {
	ID        string
	UserID    string
	SessionID string
	TenantID  string
	Conn      *websocket.Conn
	Send      chan []byte
	Manager   *WebSocketManager
	LastPing  time.Time
	mu        sync.Mutex
}

// DefaultWebSocketManager implements WebSocketManager
type DefaultWebSocketManager struct {
	connections    map[string]*WebSocketConnection  // sessionID -> connection
	userConnections map[string][]string            // userID -> sessionIDs
	tenantConnections map[string][]string          // tenantID -> sessionIDs
	upgrader       websocket.Upgrader
	logger         *zap.Logger
	mu             sync.RWMutex
	ctx            context.Context
	cancel         context.CancelFunc
	wg             sync.WaitGroup
}

// NewWebSocketManager creates a new WebSocket manager
func NewWebSocketManager(logger *zap.Logger) *DefaultWebSocketManager {
	ctx, cancel := context.WithCancel(context.Background())
	
	return &DefaultWebSocketManager{
		connections:       make(map[string]*WebSocketConnection),
		userConnections:   make(map[string][]string),
		tenantConnections: make(map[string][]string),
		upgrader: websocket.Upgrader{
			CheckOrigin: func(r *http.Request) bool {
				// In production, implement proper origin checking
				return true
			},
			ReadBufferSize:  1024,
			WriteBufferSize: 1024,
		},
		logger: logger,
		ctx:    ctx,
		cancel: cancel,
	}
}

// Start starts the WebSocket manager
func (wsm *DefaultWebSocketManager) Start() error {
	// Start ping worker
	wsm.wg.Add(1)
	go wsm.pingWorker()

	// Start cleanup worker
	wsm.wg.Add(1)
	go wsm.cleanupWorker()

	wsm.logger.Info("WebSocket manager started")
	return nil
}

// Stop stops the WebSocket manager
func (wsm *DefaultWebSocketManager) Stop() error {
	wsm.cancel()
	
	// Close all connections
	wsm.mu.Lock()
	for _, conn := range wsm.connections {
		conn.Conn.Close()
	}
	wsm.mu.Unlock()

	wsm.wg.Wait()
	wsm.logger.Info("WebSocket manager stopped")
	return nil
}

// HandleWebSocket handles WebSocket upgrade requests
func (wsm *DefaultWebSocketManager) HandleWebSocket(w http.ResponseWriter, r *http.Request, userID, sessionID, tenantID string) error {
	conn, err := wsm.upgrader.Upgrade(w, r, nil)
	if err != nil {
		wsm.logger.Error("WebSocket upgrade failed", zap.Error(err))
		return err
	}

	wsConn := &WebSocketConnection{
		ID:        sessionID,
		UserID:    userID,
		SessionID: sessionID,
		TenantID:  tenantID,
		Conn:      conn,
		Send:      make(chan []byte, 256),
		Manager:   wsm,
		LastPing:  time.Now(),
	}

	// Add connection
	if err := wsm.AddConnection(userID, sessionID, wsConn); err != nil {
		conn.Close()
		return err
	}

	// Start connection handlers
	go wsConn.writePump()
	go wsConn.readPump()

	wsm.logger.Info("WebSocket connection established",
		zap.String("user_id", userID),
		zap.String("session_id", sessionID),
		zap.String("tenant_id", tenantID))

	return nil
}

// AddConnection adds a WebSocket connection
func (wsm *DefaultWebSocketManager) AddConnection(userID, sessionID string, conn interface{}) error {
	wsConn, ok := conn.(*WebSocketConnection)
	if !ok {
		return fmt.Errorf("invalid connection type")
	}

	wsm.mu.Lock()
	defer wsm.mu.Unlock()

	// Remove existing connection if exists
	if existingConn, exists := wsm.connections[sessionID]; exists {
		existingConn.Conn.Close()
		wsm.removeConnectionLocked(sessionID)
	}

	// Add new connection
	wsm.connections[sessionID] = wsConn

	// Add to user connections
	wsm.userConnections[userID] = append(wsm.userConnections[userID], sessionID)

	// Add to tenant connections
	if wsConn.TenantID != "" {
		wsm.tenantConnections[wsConn.TenantID] = append(wsm.tenantConnections[wsConn.TenantID], sessionID)
	}

	wsm.logger.Debug("WebSocket connection added",
		zap.String("user_id", userID),
		zap.String("session_id", sessionID),
		zap.Int("total_connections", len(wsm.connections)))

	return nil
}

// RemoveConnection removes a WebSocket connection
func (wsm *DefaultWebSocketManager) RemoveConnection(sessionID string) error {
	wsm.mu.Lock()
	defer wsm.mu.Unlock()

	return wsm.removeConnectionLocked(sessionID)
}

// removeConnectionLocked removes a connection (must be called with lock held)
func (wsm *DefaultWebSocketManager) removeConnectionLocked(sessionID string) error {
	conn, exists := wsm.connections[sessionID]
	if !exists {
		return fmt.Errorf("connection not found: %s", sessionID)
	}

	// Remove from connections map
	delete(wsm.connections, sessionID)

	// Remove from user connections
	userSessions := wsm.userConnections[conn.UserID]
	for i, sid := range userSessions {
		if sid == sessionID {
			wsm.userConnections[conn.UserID] = append(userSessions[:i], userSessions[i+1:]...)
			break
		}
	}

	// Clean up empty user connections
	if len(wsm.userConnections[conn.UserID]) == 0 {
		delete(wsm.userConnections, conn.UserID)
	}

	// Remove from tenant connections
	if conn.TenantID != "" {
		tenantSessions := wsm.tenantConnections[conn.TenantID]
		for i, sid := range tenantSessions {
			if sid == sessionID {
				wsm.tenantConnections[conn.TenantID] = append(tenantSessions[:i], tenantSessions[i+1:]...)
				break
			}
		}

		// Clean up empty tenant connections
		if len(wsm.tenantConnections[conn.TenantID]) == 0 {
			delete(wsm.tenantConnections, conn.TenantID)
		}
	}

	wsm.logger.Debug("WebSocket connection removed",
		zap.String("session_id", sessionID),
		zap.String("user_id", conn.UserID),
		zap.Int("remaining_connections", len(wsm.connections)))

	return nil
}

// Broadcast sends an event to all connected clients
func (wsm *DefaultWebSocketManager) Broadcast(event *Event) error {
	message, err := wsm.createMessage("event", event)
	if err != nil {
		return err
	}

	wsm.mu.RLock()
	connections := make([]*WebSocketConnection, 0, len(wsm.connections))
	for _, conn := range wsm.connections {
		// Filter by tenant if event has tenant ID
		if event.TenantID != "" && conn.TenantID != event.TenantID {
			continue
		}
		connections = append(connections, conn)
	}
	wsm.mu.RUnlock()

	for _, conn := range connections {
		select {
		case conn.Send <- message:
		default:
			// Channel is full, close connection
			wsm.RemoveConnection(conn.SessionID)
		}
	}

	wsm.logger.Debug("Event broadcasted",
		zap.String("event_id", event.ID),
		zap.Int("connections", len(connections)))

	return nil
}

// SendToUser sends an event to all connections of a specific user
func (wsm *DefaultWebSocketManager) SendToUser(userID string, event *Event) error {
	message, err := wsm.createMessage("event", event)
	if err != nil {
		return err
	}

	wsm.mu.RLock()
	sessionIDs := wsm.userConnections[userID]
	connections := make([]*WebSocketConnection, 0, len(sessionIDs))
	for _, sessionID := range sessionIDs {
		if conn, exists := wsm.connections[sessionID]; exists {
			connections = append(connections, conn)
		}
	}
	wsm.mu.RUnlock()

	sentCount := 0
	for _, conn := range connections {
		select {
		case conn.Send <- message:
			sentCount++
		default:
			// Channel is full, close connection
			wsm.RemoveConnection(conn.SessionID)
		}
	}

	wsm.logger.Debug("Event sent to user",
		zap.String("user_id", userID),
		zap.String("event_id", event.ID),
		zap.Int("connections", sentCount))

	return nil
}

// SendToSession sends an event to a specific session
func (wsm *DefaultWebSocketManager) SendToSession(sessionID string, event *Event) error {
	message, err := wsm.createMessage("event", event)
	if err != nil {
		return err
	}

	wsm.mu.RLock()
	conn, exists := wsm.connections[sessionID]
	wsm.mu.RUnlock()

	if !exists {
		return fmt.Errorf("session not found: %s", sessionID)
	}

	select {
	case conn.Send <- message:
		wsm.logger.Debug("Event sent to session",
			zap.String("session_id", sessionID),
			zap.String("event_id", event.ID))
		return nil
	default:
		// Channel is full, close connection
		wsm.RemoveConnection(sessionID)
		return fmt.Errorf("session channel full: %s", sessionID)
	}
}

// GetConnections returns all connections for a user
func (wsm *DefaultWebSocketManager) GetConnections(userID string) []interface{} {
	wsm.mu.RLock()
	defer wsm.mu.RUnlock()

	sessionIDs := wsm.userConnections[userID]
	connections := make([]interface{}, 0, len(sessionIDs))

	for _, sessionID := range sessionIDs {
		if conn, exists := wsm.connections[sessionID]; exists {
			connections = append(connections, conn)
		}
	}

	return connections
}

// GetConnectionCount returns the total number of connections
func (wsm *DefaultWebSocketManager) GetConnectionCount() int {
	wsm.mu.RLock()
	defer wsm.mu.RUnlock()
	return len(wsm.connections)
}

// GetUserConnectionCount returns the number of connections for a user
func (wsm *DefaultWebSocketManager) GetUserConnectionCount(userID string) int {
	wsm.mu.RLock()
	defer wsm.mu.RUnlock()
	return len(wsm.userConnections[userID])
}

// createMessage creates a WebSocket message
func (wsm *DefaultWebSocketManager) createMessage(messageType string, data interface{}) ([]byte, error) {
	message := map[string]interface{}{
		"type":      messageType,
		"data":      data,
		"timestamp": time.Now(),
	}

	return json.Marshal(message)
}

// pingWorker sends ping messages to keep connections alive
func (wsm *DefaultWebSocketManager) pingWorker() {
	defer wsm.wg.Done()
	
	ticker := time.NewTicker(30 * time.Second)
	defer ticker.Stop()

	for {
		select {
		case <-wsm.ctx.Done():
			return
		case <-ticker.C:
			wsm.sendPings()
		}
	}
}

// sendPings sends ping messages to all connections
func (wsm *DefaultWebSocketManager) sendPings() {
	wsm.mu.RLock()
	connections := make([]*WebSocketConnection, 0, len(wsm.connections))
	for _, conn := range wsm.connections {
		connections = append(connections, conn)
	}
	wsm.mu.RUnlock()

	pingMessage, _ := wsm.createMessage("ping", map[string]interface{}{})

	for _, conn := range connections {
		select {
		case conn.Send <- pingMessage:
			conn.mu.Lock()
			conn.LastPing = time.Now()
			conn.mu.Unlock()
		default:
			// Channel is full, close connection
			wsm.RemoveConnection(conn.SessionID)
		}
	}
}

// cleanupWorker removes stale connections
func (wsm *DefaultWebSocketManager) cleanupWorker() {
	defer wsm.wg.Done()
	
	ticker := time.NewTicker(60 * time.Second)
	defer ticker.Stop()

	for {
		select {
		case <-wsm.ctx.Done():
			return
		case <-ticker.C:
			wsm.cleanupStaleConnections()
		}
	}
}

// cleanupStaleConnections removes connections that haven't responded to pings
func (wsm *DefaultWebSocketManager) cleanupStaleConnections() {
	staleThreshold := 2 * time.Minute
	now := time.Now()

	wsm.mu.RLock()
	staleConnections := make([]string, 0)
	for sessionID, conn := range wsm.connections {
		conn.mu.Lock()
		lastPing := conn.LastPing
		conn.mu.Unlock()

		if now.Sub(lastPing) > staleThreshold {
			staleConnections = append(staleConnections, sessionID)
		}
	}
	wsm.mu.RUnlock()

	for _, sessionID := range staleConnections {
		wsm.RemoveConnection(sessionID)
		wsm.logger.Debug("Removed stale WebSocket connection",
			zap.String("session_id", sessionID))
	}
}

// Connection methods

// readPump handles reading from the WebSocket connection
func (c *WebSocketConnection) readPump() {
	defer func() {
		c.Manager.RemoveConnection(c.SessionID)
		c.Conn.Close()
	}()

	c.Conn.SetReadLimit(512)
	c.Conn.SetReadDeadline(time.Now().Add(60 * time.Second))
	c.Conn.SetPongHandler(func(string) error {
		c.Conn.SetReadDeadline(time.Now().Add(60 * time.Second))
		c.mu.Lock()
		c.LastPing = time.Now()
		c.mu.Unlock()
		return nil
	})

	for {
		_, message, err := c.Conn.ReadMessage()
		if err != nil {
			if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseAbnormalClosure) {
				c.Manager.logger.Error("WebSocket read error", zap.Error(err))
			}
			break
		}

		// Handle incoming messages
		c.handleMessage(message)
	}
}

// writePump handles writing to the WebSocket connection
func (c *WebSocketConnection) writePump() {
	ticker := time.NewTicker(54 * time.Second)
	defer func() {
		ticker.Stop()
		c.Conn.Close()
	}()

	for {
		select {
		case message, ok := <-c.Send:
			c.Conn.SetWriteDeadline(time.Now().Add(10 * time.Second))
			if !ok {
				c.Conn.WriteMessage(websocket.CloseMessage, []byte{})
				return
			}

			if err := c.Conn.WriteMessage(websocket.TextMessage, message); err != nil {
				c.Manager.logger.Error("WebSocket write error", zap.Error(err))
				return
			}

		case <-ticker.C:
			c.Conn.SetWriteDeadline(time.Now().Add(10 * time.Second))
			if err := c.Conn.WriteMessage(websocket.PingMessage, nil); err != nil {
				return
			}
		}
	}
}

// handleMessage handles incoming WebSocket messages
func (c *WebSocketConnection) handleMessage(message []byte) {
	var msg map[string]interface{}
	if err := json.Unmarshal(message, &msg); err != nil {
		c.Manager.logger.Error("Invalid WebSocket message", zap.Error(err))
		return
	}

	msgType, ok := msg["type"].(string)
	if !ok {
		return
	}

	switch msgType {
	case "pong":
		c.mu.Lock()
		c.LastPing = time.Now()
		c.mu.Unlock()
		
	case "subscribe":
		// Handle subscription requests
		c.handleSubscription(msg)
		
	case "unsubscribe":
		// Handle unsubscription requests
		c.handleUnsubscription(msg)
	}
}

// handleSubscription handles subscription requests
func (c *WebSocketConnection) handleSubscription(msg map[string]interface{}) {
	// Implementation for subscribing to specific event types or filters
	c.Manager.logger.Debug("WebSocket subscription request",
		zap.String("session_id", c.SessionID),
		zap.Any("subscription", msg))
}

// handleUnsubscription handles unsubscription requests
func (c *WebSocketConnection) handleUnsubscription(msg map[string]interface{}) {
	// Implementation for unsubscribing from event types or filters
	c.Manager.logger.Debug("WebSocket unsubscription request",
		zap.String("session_id", c.SessionID),
		zap.Any("unsubscription", msg))
}