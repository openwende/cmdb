// Package errors provides standardized error types and handling for the CMDB application.
// It defines domain-specific errors that can be used across all layers (repository, service, handler).
package apperrors

import (
	"errors"
	"fmt"
)

// Standard domain errors that can be checked using errors.Is()
var (
	// NotFound indicates a resource was not found
	ErrNotFound = errors.New("resource not found")

	// AlreadyExists indicates a resource with the same unique identifier already exists
	ErrAlreadyExists = errors.New("resource already exists")

	// InvalidInput indicates the input data is invalid
	ErrInvalidInput = errors.New("invalid input")

	// Unauthorized indicates the request is not authorized
	ErrUnauthorized = errors.New("unauthorized")

	// Forbidden indicates the operation is forbidden
	ErrForbidden = errors.New("forbidden")

	// Conflict indicates a conflict with the current state
	ErrConflict = errors.New("conflict")

	// Internal indicates an internal server error
	ErrInternal = errors.New("internal server error")

	// NotAMember indicates the resource is not a member of a collection
	ErrNotAMember = errors.New("not a member")

	// AlreadyAMember indicates the resource is already a member of a collection
	ErrAlreadyAMember = errors.New("already a member")

	// InvalidState indicates the resource is in an invalid state for the operation
	ErrInvalidState = errors.New("invalid state")
)

// AppError represents an application error with additional context
type AppError struct {
	Code    string // Machine-readable error code
	Message string // Human-readable error message
	Err     error  // Underlying error
}

// Error implements the error interface
func (e *AppError) Error() string {
	if e.Err != nil {
		return fmt.Sprintf("%s: %s (caused by: %v)", e.Code, e.Message, e.Err)
	}
	return fmt.Sprintf("%s: %s", e.Code, e.Message)
}

// Unwrap allows errors.Is() to work with AppError
func (e *AppError) Unwrap() error {
	return e.Err
}

// New creates a new AppError
func New(code, message string) *AppError {
	return &AppError{
		Code:    code,
		Message: message,
	}
}

// Wrap wraps an existing error with additional context
func Wrap(err error, code, message string) *AppError {
	return &AppError{
		Code:    code,
		Message: message,
		Err:     err,
	}
}

// Wrapf wraps an error with a formatted message
func Wrapf(err error, code, format string, args ...interface{}) *AppError {
	return &AppError{
		Code:    code,
		Message: fmt.Sprintf(format, args...),
		Err:     err,
	}
}

// Is reports whether any error in err's tree matches target
func Is(err, target error) bool {
	return errors.Is(err, target)
}

// As finds the first error in err's tree that matches target
func As(err error, target interface{}) bool {
	return errors.As(err, target)
}

// Domain-specific error constructors

// NotFoundError creates an error for not found resources
func NotFoundError(resource, identifier string) *AppError {
	return &AppError{
		Code:    "NOT_FOUND",
		Message: fmt.Sprintf("%s with identifier '%s' not found", resource, identifier),
		Err:     ErrNotFound,
	}
}

// AlreadyExistsError creates an error for duplicate resources
func AlreadyExistsError(resource, identifier string) *AppError {
	return &AppError{
		Code:    "ALREADY_EXISTS",
		Message: fmt.Sprintf("%s with identifier '%s' already exists", resource, identifier),
		Err:     ErrAlreadyExists,
	}
}

// InvalidInputError creates an error for invalid input
func InvalidInputError(field, reason string) *AppError {
	return &AppError{
		Code:    "INVALID_INPUT",
		Message: fmt.Sprintf("Invalid input for field '%s': %s", field, reason),
		Err:     ErrInvalidInput,
	}
}

// ConflictError creates an error for state conflicts
func ConflictError(resource, reason string) *AppError {
	return &AppError{
		Code:    "CONFLICT",
		Message: fmt.Sprintf("Conflict with %s: %s", resource, reason),
		Err:     ErrConflict,
	}
}

// InvalidStateError creates an error for invalid resource state
func InvalidStateError(resource, currentState, requiredState string) *AppError {
	return &AppError{
		Code:    "INVALID_STATE",
		Message: fmt.Sprintf("%s is in '%s' state, but must be in '%s' state", resource, currentState, requiredState),
		Err:     ErrInvalidState,
	}
}

// InternalError creates an internal server error
func InternalError(operation string, err error) *AppError {
	return &AppError{
		Code:    "INTERNAL_ERROR",
		Message: fmt.Sprintf("Failed to %s", operation),
		Err:     err,
	}
}

// NotAMemberError creates an error when a resource is not a member
func NotAMemberError(resource, collection string) *AppError {
	return &AppError{
		Code:    "NOT_A_MEMBER",
		Message: fmt.Sprintf("%s is not a member of %s", resource, collection),
		Err:     ErrNotAMember,
	}
}

// AlreadyAMemberError creates an error when a resource is already a member
func AlreadyAMemberError(resource, collection string) *AppError {
	return &AppError{
		Code:    "ALREADY_A_MEMBER",
		Message: fmt.Sprintf("%s is already a member of %s", resource, collection),
		Err:     ErrAlreadyAMember,
	}
}

// HTTP Status Code Mapping

// HTTPStatus returns the appropriate HTTP status code for an error
func HTTPStatus(err error) int {
	if err == nil {
		return 200
	}

	// Check for domain errors
	switch {
	case Is(err, ErrNotFound):
		return 404
	case Is(err, ErrAlreadyExists):
		return 409
	case Is(err, ErrInvalidInput):
		return 400
	case Is(err, ErrUnauthorized):
		return 401
	case Is(err, ErrForbidden):
		return 403
	case Is(err, ErrConflict):
		return 409
	case Is(err, ErrNotAMember):
		return 404
	case Is(err, ErrAlreadyAMember):
		return 409
	case Is(err, ErrInvalidState):
		return 400
	default:
		return 500
	}
}

// ErrorResponse represents a standard error response for APIs
type ErrorResponse struct {
	Success   bool   `json:"success"`
	Error     string `json:"error"`
	Message   string `json:"message,omitempty"`
	RequestID string `json:"request_id,omitempty"`
}

// NewErrorResponse creates a standard error response
func NewErrorResponse(err error, requestID string) ErrorResponse {
	if err == nil {
		return ErrorResponse{Success: true}
	}

	var appErr *AppError
	if As(err, &appErr) {
		return ErrorResponse{
			Success:   false,
			Error:     appErr.Code,
			Message:   appErr.Message,
			RequestID: requestID,
		}
	}

	return ErrorResponse{
		Success:   false,
		Error:     "INTERNAL_ERROR",
		Message:   "An internal error occurred",
		RequestID: requestID,
	}
}
