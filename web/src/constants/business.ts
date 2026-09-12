/**
 * Business-related constants for create operations
 * Contains constants for different business create types used in URL parameters
 * Used for handling business creation operations via URL query parameters
 */

export const CREATE_TYPES = {
  BUSINESS: 1, // Create business
  BUSINESS_SET: 2, // Create business set
  OTHER_RESOURCE: 3, // Create other types of resources
} as const;
